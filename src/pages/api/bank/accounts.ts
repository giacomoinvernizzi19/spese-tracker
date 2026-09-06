import { authenticated,body,json } from '../../../lib/api';
import { bankConfig,type BankConnection } from '../../../lib/bank';
import { safeDecrypt } from '../../../lib/encryption';
import { InputError,text } from '../../../lib/validation';
export const prerender=false;
export const GET=authenticated(async(_context,db,user)=>{
  const rows=await db.prepare('SELECT id,institution_id,institution_name,status,last_sync_at,expires_at,created_at FROM bank_connections WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all<Record<string,unknown>>();
  const states=await db.prepare('SELECT connection_id,last_attempt_at,last_success_at,last_error,retry_at FROM bank_sync_accounts WHERE user_id=?').bind(user.id).all();
  return json(rows.results.map(row=>({...row,status:row.status==='linked' && (!row.expires_at || Date.parse(String(row.expires_at))<=Date.now())?'expired':row.status,sync_accounts:states.results.filter(s=>s.connection_id===row.id)})));
});
export const DELETE=authenticated(async({request,locals},db,user)=>{
  const id=text((await body(request)).connection_id);
  const row=await db.prepare('SELECT * FROM bank_connections WHERE id=? AND user_id=?').bind(id,user.id).first<BankConnection>();
  if(!row)throw new InputError('Collegamento non trovato',404);
  const {client,key}=bankConfig(locals.runtime.env);
  await client.deleteRequisition(await safeDecrypt(row.requisition_id,key));
  // Preserve historical ledger references; a disconnected consent is no longer eligible for sync.
  await db.prepare("UPDATE bank_connections SET status='expired' WHERE id=? AND user_id=?").bind(id,user.id).run();
  return json({success:true});
});
