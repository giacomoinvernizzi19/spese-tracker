import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../src/pages/api/budgets/index';
import { apiContext, seedUser, testDatabase } from './helpers';

test('dated budget overrides recurring limit only in its own month; updating default preserves history', async () => {
  const {db,sqlite} = testDatabase(); seedUser(sqlite);
  const now = new Date();
  sqlite.prepare("INSERT INTO budgets(user_id,category_id,amount,month,year) VALUES('u',1,100,?,?)").run(now.getMonth()+1,now.getFullYear());
  sqlite.exec("INSERT INTO budgets(user_id,category_id,amount,month,year) VALUES('u',1,80,1,2000)");
  let response = await POST(apiContext(db,'/api/budgets',{category_id:1,amount:200}));
  assert.equal(response.status,200);
  response = await GET(apiContext(db,'/api/budgets'));
  const budgets = await response.json();
  assert.equal(budgets.length,1); assert.equal(budgets[0].amount,100);
  await POST(apiContext(db,'/api/budgets',{category_id:1,amount:300}));
  assert.equal(sqlite.prepare('SELECT amount FROM budgets WHERE year=2000').get()?.amount,80);
  assert.equal(sqlite.prepare('SELECT amount FROM budgets WHERE year IS NULL').get()?.amount,300);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM budgets').get()?.n,3);
  sqlite.close();
});
