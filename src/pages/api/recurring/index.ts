import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';
import { generatePendingTransactions } from '../../../lib/recurring';

export const prerender = false;

// GET - List recurring transactions
export const GET: APIRoute = async ({ cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const result = await db.prepare(`
    SELECT r.*, c.name as category_name, c.icon as category_icon
    FROM recurring_transactions r
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.user_id = ?
    ORDER BY r.active DESC, r.created_at DESC
  `).bind(user.id).all();

  return new Response(JSON.stringify(result.results), { headers: { 'Content-Type': 'application/json' } });
};

// POST - Create recurring transaction
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json();
  const { amount, type = 'expense', description, category_id, frequency, day_of_month, start_date, end_date } = body;

  if (!amount || !category_id || !frequency || !start_date) {
    return new Response(JSON.stringify({ error: 'Campi obbligatori mancanti' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const result = await db.prepare(`
    INSERT INTO recurring_transactions (user_id, amount, type, description, category_id, frequency, day_of_month, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, amount, type, description || '', category_id, frequency, day_of_month || null, start_date, end_date || null).run();

  // Generate any pending transactions immediately
  const generated = await generatePendingTransactions(db, user.id);

  return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id, generated }), {
    status: 201, headers: { 'Content-Type': 'application/json' }
  });
};

// PUT - Update recurring transaction
export const PUT: APIRoute = async ({ request, cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json();
  const { id, amount, type, description, category_id, frequency, day_of_month, start_date, end_date, active } = body;

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID mancante' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Verify ownership
  const existing = await db.prepare('SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ?')
    .bind(id, user.id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Non trovato' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  await db.prepare(`
    UPDATE recurring_transactions
    SET amount = ?, type = ?, description = ?, category_id = ?, frequency = ?,
        day_of_month = ?, start_date = ?, end_date = ?, active = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    amount, type || 'expense', description || '', category_id, frequency,
    day_of_month || null, start_date, end_date || null, active !== undefined ? (active ? 1 : 0) : 1,
    id, user.id
  ).run();

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
};

// DELETE - Delete recurring transaction
export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  const db = locals.runtime.env.DB;
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json();
  const { id } = body;

  await db.prepare('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?')
    .bind(id, user.id).run();

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
};
