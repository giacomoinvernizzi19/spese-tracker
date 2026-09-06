import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
const migrations = readdirSync('migrations').filter(n => n.endsWith('.sql')).sort();
const sql = (name: string) => readFileSync(`migrations/${name}`, 'utf8');
const create = (through = migrations.length) => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  for (const file of migrations.slice(0, through)) db.exec(sql(file));
  return db;
};
test('legacy upgrade preserves dated budgets and ledger rows, converges with fresh schema', () => {
  const db = create(7);
  db.exec("INSERT INTO users(id,email,password_hash,name) VALUES('u','test@example.test','unused','Test'); INSERT INTO categories(id,user_id,name) VALUES(1,'u','Food'); INSERT INTO budgets(user_id,category_id,amount,month,year) VALUES('u',1,100,1,2026),('u',1,150,2,2026); INSERT INTO transactions(user_id,amount,date,description,source) VALUES('u',12.34,'2026-01-01','Example','import');");
  const before = db.prepare('SELECT id,user_id,amount,type,description,category_id,date,created_at,updated_at,source FROM transactions').all();
  db.exec(sql(migrations[7]));
  assert.deepEqual(db.prepare('SELECT id,user_id,amount,type,description,category_id,date,created_at,updated_at,source FROM transactions').all(), before);
  assert.deepEqual(db.prepare('SELECT amount,month,year,period FROM budgets ORDER BY month').all().map(r => ({...r})), [{amount:100,month:1,year:2026,period:'monthly'},{amount:150,month:2,year:2026,period:'monthly'}]);
  const schema = (d: DatabaseSync) => d.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const fresh = create();
  assert.deepEqual(schema(db), schema(fresh));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close(); fresh.close();
});
test('database rejects duplicate recurring occurrences and import rows', () => {
  const db = create();
  db.exec("INSERT INTO users(id,email,password_hash,name) VALUES('u','test@example.test','unused','Test');");
  const recurring = "INSERT INTO transactions(user_id,amount,date,source,recurring_id,occurrence_date) VALUES('u',10,'2026-01-01','recurring',1,'2026-01-01')";
  db.exec(recurring); assert.throws(() => db.exec(recurring), /UNIQUE/);
  const imported = "INSERT INTO transactions(user_id,amount,date,source,import_batch_id,import_row_id) VALUES('u',10,'2026-01-01','import','batch',1)";
  db.exec(imported); assert.throws(() => db.exec(imported), /UNIQUE/);
  db.exec(imported.replace("'batch',1", "'batch',2"));
  assert.equal(db.prepare('SELECT count(*) AS n FROM transactions').get()?.n, 3);
  db.close();
});
test('upgrade preserves deleted high-water IDs in both rebuilt tables', () => {
  const db = create(7);
  db.exec("INSERT INTO users(id,email,password_hash,name) VALUES('u','test@example.test','unused','Test'); INSERT INTO budgets(id,user_id,amount,month,year) VALUES(100,'u',100,1,2026); DELETE FROM budgets; INSERT INTO transactions(id,user_id,amount,date) VALUES(200,'u',1,'2026-01-01'); DELETE FROM transactions;");
  db.exec(sql(migrations[7]));
  db.exec("INSERT INTO budgets(user_id,amount) VALUES('u',1); INSERT INTO transactions(user_id,amount,date) VALUES('u',1,'2026-01-01');");
  assert.equal(db.prepare('SELECT id FROM budgets').get()?.id, 101);
  assert.equal(db.prepare('SELECT id FROM transactions').get()?.id, 201);
  db.close();
});
