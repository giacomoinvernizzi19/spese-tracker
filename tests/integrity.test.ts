import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, seedUser, apiContext } from './helpers';
import { createTransaction } from '../src/lib/transactions';
import { getDueDates, generatePendingTransactions, type Recurring } from '../src/lib/recurring';
import { importAmount, importDate } from '../src/lib/import';
import { getAuthUser } from '../src/lib/auth';
import { POST as reset } from '../src/pages/api/auth/reset-password';
import { POST as transaction } from '../src/pages/api/transactions/index';
import { displayText, displayColor, displayImage } from '../src/lib/display';

const recurring: Recurring = {id:1,user_id:'u',amount:10,type:'expense',description:'Test',category_id:1,frequency:'monthly',day_of_month:31,start_date:'2024-01-31',end_date:null,last_generated:null};
test('calendar clamps month end and leap anniversary, includes Sunday and expired arrears',()=>{
  assert.deepEqual(getDueDates(recurring,'2024-04-30'),['2024-01-31','2024-02-29','2024-03-31','2024-04-30']);
  assert.deepEqual(getDueDates({...recurring,frequency:'weekly',day_of_month:0,start_date:'2024-02-01',end_date:'2024-02-11'},'2024-03-01'),['2024-02-04','2024-02-11']);
  assert.deepEqual(getDueDates({...recurring,frequency:'yearly',start_date:'2024-02-29'},'2025-03-01'),['2024-02-29','2025-02-28']);
});
test('recurrence retries do not duplicate and checkpoint failure rolls back insertion',async()=>{
  const {db,sqlite}=testDatabase(); seedUser(sqlite);
  sqlite.exec("INSERT INTO recurring_transactions(id,user_id,amount,type,category_id,frequency,day_of_month,start_date) VALUES(1,'u',10,'expense',1,'monthly',31,'2024-01-31')");
  assert.equal(await generatePendingTransactions(db,'u','2024-02-29'),2);
  sqlite.exec('UPDATE recurring_transactions SET last_generated=NULL');
  assert.equal(await generatePendingTransactions(db,'u','2024-02-29'),0);
  sqlite.exec("CREATE TRIGGER fail_checkpoint BEFORE UPDATE ON recurring_transactions BEGIN SELECT RAISE(ABORT,'test failure'); END");
  await assert.rejects(generatePendingTransactions(db,'u','2024-03-31'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM transactions').get()!.n,2);
  sqlite.close();
});
test('import retry keys preserve identical distinct rows and reject conflicting retries',async()=>{
  const {db,sqlite}=testDatabase(); seedUser(sqlite);
  const input={amount:12.5,type:'expense',date:'2026-09-06',category_id:1,description:'Lunch',source:'import',import_batch_id:'a'.repeat(64),import_row_id:0};
  assert.equal((await createTransaction(db,'u',input)).duplicate,false);
  assert.equal((await createTransaction(db,'u',input)).duplicate,true);
  assert.equal((await createTransaction(db,'u',{...input,import_row_id:1})).duplicate,false);
  await assert.rejects(createTransaction(db,'u',{...input,amount:20}),{status:409});
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM transactions').get()!.n,2);
  sqlite.close();
});
test('API rejects invalid dates, amounts and foreign categories without writing',async()=>{
  const {db,sqlite}=testDatabase(); seedUser(sqlite);
  sqlite.exec("INSERT INTO users(id,email,password_hash,name) VALUES('v','v@example.test','unused','Other'); INSERT INTO categories(id,user_id,name) VALUES(2,'v','Private')");
  const valid={amount:10,type:'expense',date:'2026-09-06',category_id:1};
  for(const invalid of [{amount:-1},{amount:'10'},{date:'2026-02-30'},{category_id:2},{type:'other'},{source:'bank'}]) {
    assert.equal((await transaction(apiContext(db,'/api/transactions',{...valid,...invalid}))).status,400);
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM transactions').get()!.n,0);
  sqlite.close();
});
test('ISO session expiry compares instants instead of date string formats',async()=>{
  const {db,sqlite}=testDatabase(); seedUser(sqlite);
  sqlite.prepare('UPDATE sessions SET expires_at=?').run(new Date(Date.now()-60000).toISOString());
  assert.equal(await getAuthUser(apiContext(db,'/').cookies,db),null);
  sqlite.close();
});
test('password reset consumes token once and revokes sessions',async()=>{
  const {db,sqlite}=testDatabase(); seedUser(sqlite);
  sqlite.exec("INSERT INTO password_reset_tokens(id,user_id,token,expires_at) VALUES('reset-id','u','synthetic-reset-token','2099-01-01T00:00:00Z')");
  const context=()=>apiContext(db,'/api/auth/reset-password',{token:'synthetic-reset-token',password:'NewPassword123!'});
  assert.equal((await reset(context())).status,200);
  const hash=sqlite.prepare("SELECT password_hash FROM users WHERE id='u'").get()!.password_hash;
  assert.equal((await reset(context())).status,400);
  assert.equal(sqlite.prepare("SELECT password_hash FROM users WHERE id='u'").get()!.password_hash,hash);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM sessions').get()!.n,0);
  sqlite.close();
});
test('import parsing and HTML sinks reject ambiguous or active content',()=>{
  assert.equal(importAmount('1.234,56'),1234.56);
  assert.equal(importAmount('12,50'),12.5);
  assert.throws(()=>importAmount('1,234.56'));
  assert.throws(()=>importDate('31/02/2026'));
  assert.equal(importDate('06/09/2026'),'2026-09-06');
  assert.ok(!displayText('<img src=x onerror="alert(1)">').includes('<'));
  assert.equal(displayColor('red; background:url(x)'),'#6B7280');
  assert.equal(displayImage('javascript:alert(1)'),'');
});
