import { createNordigenClient, NordigenClient, ProviderError, type Transaction } from './nordigen';
import { encrypt, safeDecrypt } from './encryption';
import { importDigest } from './import';
import { dateOnly, InputError } from './validation';

export function bankConfig(env:WorkerEnv) {
  const client=createNordigenClient(env);
  if(!env.ENCRYPTION_KEY || !/^[a-f0-9]{64}$/i.test(env.ENCRYPTION_KEY)) throw new InputError('Cifratura bancaria non configurata',503);
  let url:URL;try {url=new URL(env.APP_URL);}catch{throw new InputError('URL applicazione non configurato',503);}
  if(url.protocol!=='https:' && url.hostname!=='localhost')throw new InputError('URL applicazione non valido',503);
  return {client,key:env.ENCRYPTION_KEY,appUrl:url.origin};
}
export interface BankConnection {id:string;user_id:string;institution_id:string;requisition_id:string;account_ids:string|null;status:string;expires_at:string|null;historical_days:number|null;}
export async function refreshConsent(db:D1Database,connection:BankConnection,client:NordigenClient,key:string,now=new Date()) {
  const id=await safeDecrypt(connection.requisition_id,key);
  const req=await client.getRequisition(id);
  if(req.id!==id || req.reference!==connection.id || req.institution_id!==connection.institution_id) throw new InputError('Consenso bancario non corrispondente',409);
  if(req.status!=='LN') {
    await db.prepare('UPDATE bank_connections SET status=? WHERE id=? AND user_id=?').bind(req.status==='EX'?'expired':req.status==='RJ'?'error':'pending',connection.id,connection.user_id).run();
    throw new InputError('Consenso non attivo: ricollega il conto',409);
  }
  const agreement=await client.getAgreement(req.agreement);
  const accepted=Date.parse(agreement.accepted);
  if(!Number.isFinite(accepted) || agreement.institution_id!==connection.institution_id || !Number.isInteger(agreement.access_valid_for_days) || agreement.access_valid_for_days<=0 || !Number.isInteger(agreement.max_historical_days) || agreement.max_historical_days<=0 || !Array.isArray(req.accounts) || !req.accounts.length) throw new InputError('Termini del consenso non verificabili',502);
  const expires=new Date(accepted+agreement.access_valid_for_days*86400000).toISOString();
  const status=Date.parse(expires)>now.getTime()?'linked':'expired';
  await db.prepare('UPDATE bank_connections SET requisition_id=?,account_ids=?,status=?,expires_at=?,historical_days=? WHERE id=? AND user_id=?').bind(await encrypt(id,key),await encrypt(JSON.stringify(req.accounts),key),status,expires,agreement.max_historical_days,connection.id,connection.user_id).run();
  if(status!=='linked') throw new InputError('Consenso scaduto: ricollega il conto',409);
  return {...connection,account_ids:JSON.stringify(req.accounts),expires_at:expires,historical_days:agreement.max_historical_days};
}
export function bankTransaction(tx:Transaction) {
  if(tx.transactionAmount?.currency!=='EUR') return null;
  const raw=tx.transactionAmount.amount;
  if(typeof raw!=='string'|| !/^-?\d+(\.\d{1,2})?$/.test(raw))throw new InputError('Importo bancario non valido');
  const signed=Number(raw);if(!Number.isFinite(signed)||signed===0)throw new InputError('Importo bancario non valido');
  return {amount:Math.abs(signed),type:signed<0?'expense':'income',date:dateOnly(tx.bookingDate ?? tx.valueDate),description:tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || 'Transazione bancaria'};
}
export interface AccountSyncResult {account:string;fetched:number;staged:number;duplicates:number;excluded:number;error?:string;retry_at?:string;from?:string;to?:string;notice?:string;}
// Every new movement is staged for review, so overlapping historical imports cannot inflate totals.
export async function syncConnection(db:D1Database,connection:BankConnection,client:NordigenClient,key:string,from:string|undefined,to:string,now=new Date()):Promise<AccountSyncResult[]> {
  const verified=await refreshConsent(db,connection,client,key,now);
  const ids=JSON.parse(verified.account_ids! as string) as string[];
  const results:AccountSyncResult[]=[];
  for(const id of ids) {
    const result:AccountSyncResult={account:String(results.length+1),fetched:0,staged:0,duplicates:0,excluded:0};results.push(result);
    let accountKey:string|undefined;const lease=crypto.randomUUID();let acquired=false,gateAcquired=false;
    const providerKey=await importDigest(id);
    await db.prepare('INSERT INTO bank_request_gates(user_id,provider_key) VALUES(?,?) ON CONFLICT DO NOTHING').bind(connection.user_id,providerKey).run();
    try {
      const gate=await db.prepare("UPDATE bank_request_gates SET lease_token=?,lease_until=datetime('now','+10 minutes') WHERE user_id=? AND provider_key=? AND (lease_until IS NULL OR julianday(lease_until)<julianday('now')) AND (retry_at IS NULL OR julianday(retry_at)<=julianday('now'))").bind(lease,connection.user_id,providerKey).run();
      if(!gate.meta.changes)throw new InputError('Sincronizzazione in corso o attesa richiesta dal provider',409);
      gateAcquired=true;
      const details=(await client.getAccountDetails(id)).account;
      const iban=details.iban?.replace(/\s/g,'').toUpperCase();
      const stable=!!iban && /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
      accountKey=await importDigest(`${connection.institution_id}:${stable?iban:id}`);
      await db.prepare(`INSERT INTO bank_sync_accounts(user_id,account_key,connection_id,provider_account_id,currency) VALUES(?,?,?,?,?) ON CONFLICT(user_id,account_key) DO NOTHING`).bind(connection.user_id,accountKey,connection.id,await encrypt(id,key),details.currency ?? null).run();
      const claim=await db.prepare(`UPDATE bank_sync_accounts SET lease_token=?,lease_until=datetime('now','+10 minutes'),last_attempt_at=CURRENT_TIMESTAMP WHERE user_id=? AND account_key=? AND (lease_until IS NULL OR julianday(lease_until)<julianday('now')) AND (retry_at IS NULL OR julianday(retry_at)<=julianday('now'))`).bind(lease,connection.user_id,accountKey).run();
      if(!claim.meta.changes)throw new InputError('Sincronizzazione già in corso o attesa richiesta dal provider',409);
      acquired=true;
      const state=await db.prepare('SELECT covered_through FROM bank_sync_accounts WHERE user_id=? AND account_key=?').bind(connection.user_id,accountKey).first<{covered_through:string|null}>();
      const earliest=new Date(now.getTime()-verified.historical_days!*86400000).toISOString().slice(0,10);
      const requestedFrom=from ?? (state?.covered_through?new Date(Date.parse(state.covered_through)-7*86400000).toISOString().slice(0,10):earliest);
      const effectiveFrom=requestedFrom<earliest?earliest:requestedFrom;
      result.from=effectiveFrom;result.to=to;
      if(requestedFrom<earliest)result.notice='Parte del periodo richiesto precede lo storico reso disponibile dal consenso';
      if(effectiveFrom>to)throw new InputError('Intervallo fuori dallo storico disponibile');
      const response=await client.getTransactions(id,effectiveFrom,to);
      if(!Array.isArray(response.transactions?.booked))throw new ProviderError(502);
      const occurrences=new Map<string,number>();
      for(const tx of response.transactions.booked) {
        result.fetched++;
        const value=bankTransaction(tx);if(!value){result.excluded++;continue;}
        if(value.date<effectiveFrom || value.date>to)continue;
        const providerId=typeof tx.transactionId==='string' && tx.transactionId ? tx.transactionId : null;
        const external=stable && providerId ? await importDigest(`${accountKey}:${providerId}`) : null;
        const fingerprint=await importDigest(JSON.stringify(value));
        const occurrence=occurrences.get(fingerprint) ?? 0;occurrences.set(fingerprint,occurrence+1);
        // Fingerprint plus multiplicity identifies a review candidate, never a booked ledger row.
        const candidateKey=external ?? `${fingerprint}:${occurrence}`;
        const inserted=await db.prepare(`INSERT INTO bank_candidates(user_id,account_key,candidate_key,external_id,connection_id,amount,type,date,description,reason) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bank_sync_accounts WHERE user_id=? AND account_key=? AND lease_token=? AND julianday(lease_until)>julianday('now')) ON CONFLICT(user_id,account_key,candidate_key) DO NOTHING`).bind(connection.user_id,accountKey,candidateKey,external,connection.id,value.amount,value.type,value.date,value.description,external?'review_overlap':'identity_unverified',connection.user_id,accountKey,lease).run();
        if(inserted.meta.changes)result.staged++;
        else {
          const existing=await db.prepare('SELECT amount,type,date,description FROM bank_candidates WHERE user_id=? AND account_key=? AND candidate_key=?').bind(connection.user_id,accountKey,candidateKey).first<Record<string,unknown>>();
          if(!existing || Object.entries(value).some(([name,v])=>existing[name]!==v))throw new InputError('Movimento modificato dal provider: riconciliazione richiesta',409);
          result.duplicates++;
        }
      }
      const finished=await db.prepare(`UPDATE bank_sync_accounts SET connection_id=?,provider_account_id=?,last_success_at=CURRENT_TIMESTAMP,covered_through=CASE WHEN ?<=COALESCE(date(covered_through,'+1 day'),?) THEN MAX(COALESCE(covered_through,?),?) ELSE covered_through END,last_error=NULL,retry_at=NULL,lease_token=NULL,lease_until=NULL WHERE user_id=? AND account_key=? AND lease_token=? AND julianday(lease_until)>julianday('now')`).bind(connection.id,await encrypt(id,key),effectiveFrom,earliest,to,to,connection.user_id,accountKey,lease).run();
      if(!finished.meta.changes)throw new InputError('Sincronizzazione interrotta: riprova',409);
    } catch(error) {
      result.error=error instanceof InputError?error.message:error instanceof ProviderError?`Provider non disponibile (${error.status})`:'Sincronizzazione non completata';
      if(error instanceof ProviderError && error.status===429) {
        const seconds=Number(error.retryAfter);const date=error.retryAfter && !Number.isFinite(seconds)?Date.parse(error.retryAfter):NaN;
        result.retry_at=new Date(Number.isFinite(date)?Math.max(Date.now()+60000,date):Date.now()+(Number.isFinite(seconds)&&seconds>0?seconds:3600)*1000).toISOString();
      }
      if(accountKey && acquired)await db.prepare('UPDATE bank_sync_accounts SET last_error=?,retry_at=?,lease_token=NULL,lease_until=NULL WHERE user_id=? AND account_key=? AND lease_token=?').bind(result.error,result.retry_at ?? null,connection.user_id,accountKey,lease).run();
    } finally {
      if(gateAcquired)await db.prepare('UPDATE bank_request_gates SET lease_token=NULL,lease_until=NULL,retry_at=? WHERE user_id=? AND provider_key=? AND lease_token=?').bind(result.retry_at ?? null,connection.user_id,providerKey,lease).run();
    }
  }
  if(results.length && results.every(r=>!r.error))await db.prepare('UPDATE bank_connections SET last_sync_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(connection.id,connection.user_id).run();
  return results;
}
