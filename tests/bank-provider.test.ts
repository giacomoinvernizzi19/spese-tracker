import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/pages/api/bank/institutions';
import { apiContext, seedUser, testDatabase } from './helpers';

test('catalog provider failures remain actionable without exposing upstream payload or credentials', async () => {
  const { db, sqlite } = testDatabase();
  seedUser(sqlite);
  const fetchBefore = globalThis.fetch;
  try {
    for (const [upstream, expected, message] of [[403, 502, 'IP consentiti'], [401, 502, 'credenziali'], [429, 503, 'Limite richieste'], [500, 502, 'temporaneamente']] as const) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response('private-provider-payload', {status: upstream}); };
      const context = apiContext(db, '/api/bank/institutions');
      Object.assign(context.locals.runtime.env, {NORDIGEN_SECRET_ID:'test-id', NORDIGEN_SECRET_KEY:'test-key'});
      const response = await GET(context);
      const body = await response.text();
      assert.equal(response.status, expected);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.ok(body.includes(message));
      assert.ok(!/private-provider-payload|test-key|test-id/.test(body));
      assert.equal(calls, 1, 'authentication failure must stop before requesting the catalog');
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM bank_connections').get()!.count, 0);
  } finally { globalThis.fetch = fetchBefore; sqlite.close(); }
});
