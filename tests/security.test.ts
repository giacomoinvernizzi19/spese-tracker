import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { disabledFrameworkRoute, guardWorker } from '../src/lib/worker-boundary';
import { importDate } from '../src/lib/import';

test('unused framework routes cannot forward image or server-island requests', () => {
  for (const path of ['/_image', '/_image/', '/%5fimage', '/_image%2Fextra', '/x/../_image', '/_server-islands/a', '/%5fserver-islands/a', '/%ZZ']) {
    assert.equal(disabledFrameworkRoute('https://app.test' + path), true, path);
  }
  for (const path of ['/api/bank/callback?ref=example', '/_astro/app.js', '/banche', '/_image-logo.png']) {
    assert.equal(disabledFrameworkRoute('https://app.test' + path), false, path);
  }
});

test('patched SheetJS preserves amounts, literal text and 1900/1904 date semantics', () => {
  for (const date1904 of [false, true]) {
    const serial = 46271 - (date1904 ? 1462 : 0);
    const rows = [['Data','Importo','Categoria','Descrizione'], [serial,12.34,'Casa','<img src=x onerror=alert(1)>']];
    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { WBProps: { date1904 } };
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Spese');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const restored = XLSX.read(bytes, { type: 'array', raw: true });
    const actual = XLSX.utils.sheet_to_json<unknown[]>(restored.Sheets.Spese, { header: 1 });
    assert.deepEqual(actual, rows);
    assert.equal(importDate(Number(actual[1][0]) + (restored.Workbook?.WBProps?.date1904 ? 1462 : 0)), '2026-09-06');
  }
});

test('Astro advisory boundary checks parsed markup and aliased imports', async () => {
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const checker = pathToFileURL(resolve('scripts/astro-security.mjs')).href;
  const { inspectAstro } = await import(checker);
  for (const markup of [
    '<script define:vars={{name:"x"}}></script>',
    '<div {...props}></div>',
    '<div transition:name="test"></div>',
    '<Widget server:defer />',
    '<slot name={userInput} />',
    '<div slot={userInput}></div>',
    '---\nimport {Image as Photo} from "astro:assets";\n---\n<Photo />',
    '---\nconst module = await import("astro:transitions");\n---\n<div />',
  ]) assert.ok((await inspectAstro(markup)).length > 0, markup);
  assert.deepEqual(await inspectAstro('<div class="safe"><slot /></div><!-- <div {...example} /> -->'), []);
});

test('maintenance blocks HTTP writes and scheduled jobs before any database access', async () => {
  let calls = 0;
  const worker = guardWorker({
    fetch: async () => { calls++; return new Response('ok'); },
    scheduled: async () => { calls++; },
  });
  const maintenance = { MAINTENANCE_MODE: 'true' } as WorkerEnv;
  for (const path of ['/api/transactions', '/api/cron/daily', '/api/bank/callback']) {
    const response = await worker.fetch(new Request('https://app.test'+path, { method: 'POST' }), maintenance, {});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  await worker.scheduled({}, maintenance);
  assert.equal(calls, 0);
  const active = { MAINTENANCE_MODE: 'false' } as WorkerEnv;
  assert.equal((await worker.fetch(new Request('https://app.test/_image?href=/api/transactions'), active, {})).status, 404);
  assert.equal(calls, 0);
  assert.equal((await worker.fetch(new Request('https://app.test/api/transactions'), active, {})).status, 200);
  await worker.scheduled({}, active);
  assert.equal(calls, 2);
});

test('release preparation accepts only the verified legacy schema and preserves the export', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('python3', ['-c', `
import importlib.util, sqlite3, tempfile, sys
sys.dont_write_bytecode = True
from pathlib import Path
spec = importlib.util.spec_from_file_location('prepare_upgrade', 'scripts/prepare-database-upgrade.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    db = sqlite3.connect(':memory:')
    for path in sorted(Path('migrations').glob('*.sql')):
        if path.name < '0008' and not path.name.startswith('0006'):
            db.executescript(path.read_text())
    db.execute("INSERT INTO users(id,email,password_hash,name) VALUES('test','test@example.test','unused','Test')")
    db.execute("INSERT INTO transactions(user_id,amount,date) VALUES('test',12.34,'2026-09-06')")
    backup = Path(directory)/'backup.sql'
    backup.write_text('\\n'.join(db.iterdump()))
    original = backup.read_bytes()
    output = Path(directory)/'baseline.sql'
    module.prepare(backup, output)
    assert backup.read_bytes() == original
    assert output.stat().st_mode & 0o077 == 0
    db.executescript(output.read_text())
    assert db.execute('SELECT count(*) FROM d1_migrations').fetchone()[0] == 7
    assert db.execute("SELECT count(*) FROM sqlite_master WHERE name='idx_password_reset_tokens_token'").fetchone()[0] == 1
    backup.write_text('\\n'.join(db.iterdump()))
    try:
        module.prepare(backup, Path(directory)/'repeated.sql')
        raise AssertionError('Already tracked baseline accepted')
    except ValueError:
        pass
    db.execute('DROP TABLE d1_migrations')
    db.execute('CREATE TABLE unexpected(id INTEGER)')
    backup.write_text('\\n'.join(db.iterdump()))
    try:
        module.prepare(backup, Path(directory)/'drift.sql')
        raise AssertionError('Schema drift accepted')
    except ValueError:
        pass
    assert not (Path(directory)/'drift.sql').exists()
    db.close()
`], { stdio: 'pipe' });
});
