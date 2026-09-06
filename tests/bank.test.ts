import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase,seedUser,apiContext } from './helpers';
import { encrypt,safeDecrypt } from '../src/lib/encryption';
import { bankConfig,bankTransaction,syncConnection,type BankConnection } from '../src/lib/bank';
import { POST as resolve } from '../src/pages/api/bank/candidates';
import { NordigenClient,ProviderError } from '../src/lib/nordigen';
const key='a'.repeat(64),reqId='11111111-1111-4111-8111-111111111111';
test('ciphertext is versioned; wrong keys fail instead of returning ciphertext as plaintext',async()=>{
  const data=await encrypt(reqId,key);assert.ok(data.startsWith('v1:'));
  assert.equal(await safeDecrypt(data,key),reqId);
  assert.equal(await safeDecrypt(reqId,key),reqId);
  await assert.rejects(safeDecrypt(data,'b'.repeat(64)));
  await assert.rejects(safeDecrypt('unrecognized-plaintext',key));
  assert.throws(()=>bankConfig({APP_URL:'https://example.test'} as any),{status:503});
});
test('bank amounts reject invalid values and exclude non-EUR without conversion',()=>{
  assert.equal(bankTransaction({transactionAmount:{amount:'10',currency:'USD'}}),null);
  assert.throws(()=>bankTransaction({transactionAmount:{amount:'10oops',currency:'EUR'},bookingDate:'2026-09-06'}));
  assert.throws(()=>bankTransaction({transactionAmount:{amount:'10',currency:'EUR'}}));
});
function fixture(){
  const {db,sqlite}=testDatabase();seedUser(sqlite);
  sqlite.prepare("INSERT INTO bank_connections(id,user_id,institution_id,requisition_id,status) VALUES('conn','u','BANK',?,'linked')").run(reqId);
  const connection=sqlite.prepare("SELECT * FROM bank_connections WHERE id='conn'").get() as unknown as BankConnection;
  const accounts=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
  let fail=false;
  const client={getRequisition:async()=>({id:reqId,reference:'conn',institution_id:'BANK',status:'LN',agreement:'agreement',accounts}),getAgreement:async()=>({accepted:'2026-09-05T00:00:00Z',access_valid_for_days:90,max_historical_days:90,institution_id:'BANK'}),getAccountDetails:async(id:string)=>({account:{iban:id===accounts[0]?'IT60X0542811101000000123456':'DE89370400440532013000',currency:'EUR'}}),getTransactions:async(id:string)=>{if(fail&&id===accounts[1])throw new ProviderError(429,'60');return {transactions:{booked:[{transactionId:'tx-1',bookingDate:'2026-09-06',transactionAmount:{amount:'-12.50',currency:'EUR'},remittanceInformationUnstructured:'Lunch'},{bookingDate:'2026-09-06',transactionAmount:{amount:'-5',currency:'EUR'}},{bookingDate:'2026-09-06',transactionAmount:{amount:'-5',currency:'EUR'}}]}};}} as unknown as NordigenClient;
  return {db,sqlite,connection,client,fail:()=>{fail=true;}};
}
test('sync stages separate identical rows, is replay-safe, and candidate confirmation is idempotent',async()=>{
  const {db,sqlite,connection,client}=fixture();
  const first=await syncConnection(db,connection,client,key,'2026-09-01','2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(first.reduce((n,r)=>n+r.staged,0),6);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM transactions').get()!.n,0);
  const retry=await syncConnection(db,connection,client,key,'2026-09-01','2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(retry.reduce((n,r)=>n+r.staged,0),0);
  assert.equal(retry.reduce((n,r)=>n+r.duplicates,0),6);
  const context=()=>apiContext(db,'/api/bank/candidates',{id:1,action:'import'});
  assert.equal((await resolve(context())).status,200);assert.equal((await resolve(context())).status,200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM transactions').get()!.n,1);
  assert.equal((await resolve(apiContext(db,'/api/bank/candidates',{id:2,action:'import'}))).status,400);
  sqlite.close();
});
test('partial account failure preserves only successful checkpoint and exposes retry delay',async()=>{
  const {db,sqlite,connection,client,fail}=fixture();fail();
  const result=await syncConnection(db,connection,client,key,'2026-09-01','2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(result[0].staged,3);assert.ok(result[1].error);assert.ok(result[1].retry_at);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM bank_sync_accounts WHERE last_success_at IS NOT NULL').get()!.n,1);
  assert.equal(sqlite.prepare("SELECT last_sync_at FROM bank_connections WHERE id='conn'").get()!.last_sync_at,null);
  sqlite.close();
});
test('checkpoint resumes an old gap and details 429 is persisted before another bank request',async()=>{
  const {db,sqlite,connection,client}=fixture();
  await syncConnection(db,connection,client,key,'2026-09-01','2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM bank_sync_accounts WHERE covered_through IS NOT NULL').get()!.n,0);
  sqlite.exec("UPDATE bank_sync_accounts SET covered_through='2026-08-01'");
  await syncConnection(db,connection,client,key,'2026-09-01','2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(sqlite.prepare('SELECT covered_through FROM bank_sync_accounts LIMIT 1').get()!.covered_through,'2026-08-01');
  const ranges:string[]=[];
  client.getTransactions=async(_id,from)=>{ranges.push(from!);return {transactions:{booked:[]}};};
  await syncConnection(db,connection,client,key,undefined,'2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.deepEqual(ranges,['2026-07-25','2026-07-25']);
  let calls=0;
  client.getAccountDetails=async()=>{calls++;throw new ProviderError(429,'3600');};
  const failed=await syncConnection(db,connection,client,key,undefined,'2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.ok(failed.every(item=>item.retry_at));
  await syncConnection(db,connection,client,key,undefined,'2026-09-06',new Date('2026-09-06T12:00:00Z'));
  assert.equal(calls,2);
  sqlite.close();
});
