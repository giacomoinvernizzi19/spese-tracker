import { Miniflare } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const runtime = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("test"); } }', compatibilityDate: '2026-01-04', d1Databases: ['DB'] });
try {
  const db = await runtime.getD1Database('DB');
  const files = (await readdir('migrations')).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = (await readFile(`migrations/${file}`, 'utf8')).replace(/^--.*$/gm, '');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(s => db.prepare(s)));
  }
  await db.prepare("INSERT INTO users(id,email,password_hash,name) VALUES('test','test@example.test','unused','Test')").run();
  const insert = db.prepare("INSERT INTO transactions(user_id,amount,date,source,recurring_id,occurrence_date) VALUES('test',1,'2026-09-06','recurring',1,'2026-09-06')");
  await insert.run();
  await assert.rejects(insert.run(), /UNIQUE/);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  // A later failure must roll back an earlier write in the same D1 batch.
  await assert.rejects(db.batch([
    db.prepare("INSERT INTO transactions(user_id,amount,date) VALUES('test',2,'2026-09-07')"), insert,
  ]));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM transactions').first()).n, 1);
  console.info('PASS: D1 migrations, recurring uniqueness, foreign keys and batch rollback');
} finally {
  await runtime.dispose();
}
