import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync('migrations').filter(n => n.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`migrations/${name}`, 'utf8'));
  function prepare(sql: string, values: unknown[] = []): any {
    return {
      bind: (...args: unknown[]) => prepare(sql, args),
      first: async (column?: string) => { const row = sqlite.prepare(sql).get(...values as any[]) ?? null; return column && row ? row[column] : row; },
      all: async () => ({ success: true, results: sqlite.prepare(sql).all(...values as any[]) }),
      run: async () => { const result = sqlite.prepare(sql).run(...values as any[]); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
    };
  }
  const db: any = {
    prepare,
    batch: async (statements: any[]) => {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sqlite };
}

export function apiContext(db: any, path: string, body?: unknown): any {
  return {
    request: new Request(`https://example.test${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    cookies: { get: () => ({ value: 'session-test' }), delete: () => {} },
    locals: { runtime: { env: { DB: db } } }, params: {},
  };
}

export function seedUser(sqlite: DatabaseSync) {
  sqlite.exec("INSERT INTO users(id,email,password_hash,name) VALUES('u','test@example.test','unused','Test'); INSERT INTO sessions(id,user_id,expires_at) VALUES('session-test','u','2099-01-01T00:00:00.000Z'); INSERT INTO categories(id,user_id,name) VALUES(1,'u','Food');");
}
