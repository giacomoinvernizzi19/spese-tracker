import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Lista transazioni
export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  const year = url.searchParams.get('year');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const search = url.searchParams.get('search');
  const limit = url.searchParams.get('limit') || '100';

  let query = `
    SELECT
      t.id,
      t.amount,
      t.type,
      t.description,
      t.date,
      t.category_id,
      t.created_at,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;

  const params: any[] = [user.id];

  if (from && to) {
    query += ` AND t.date >= ? AND t.date <= ?`;
    params.push(from, to);
  } else if (month && year) {
    query += ` AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }

  if (search) {
    query += ` AND LOWER(t.description) LIKE '%' || LOWER(?) || '%'`;
    params.push(search);
  }

  query += ` ORDER BY t.date DESC, t.created_at DESC LIMIT ?`;
  params.push(parseInt(limit));

  try {
    const result = await db.prepare(query).bind(...params).all();
    return new Response(JSON.stringify(result.results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Nuova transazione
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { amount, category_id, description, date, type = 'expense' } = body;

    if (!amount || !category_id || !date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify category belongs to user
    const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
      .bind(category_id, user.id).first();

    if (!category) {
      return new Response(JSON.stringify({ error: 'Categoria non valida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await db.prepare(`
      INSERT INTO transactions (user_id, amount, type, description, category_id, date, source)
      VALUES (?, ?, ?, ?, ?, ?, 'manual')
    `).bind(user.id, amount, type, description || '', category_id, date).run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
