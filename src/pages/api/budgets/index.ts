import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Lista budget dell'utente con speso e rimanente
export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'monthly';

  try {
    // Get current month/year for spending calculation
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all budgets with category info and calculate spent amount
    const budgets = await db.prepare(`
      SELECT
        b.id,
        b.category_id,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color,
        b.amount,
        b.period,
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.user_id = b.user_id
             AND (t.category_id = b.category_id
                  OR t.category_id IN (SELECT id FROM categories WHERE parent_id = b.category_id))
             AND t.type = 'expense'
             AND (
               (b.period = 'monthly' AND strftime('%m', t.date) = printf('%02d', ?) AND strftime('%Y', t.date) = ?)
               OR (b.period = 'yearly' AND strftime('%Y', t.date) = ?)
             )
          ), 0
        ) as spent
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ?
      ORDER BY c.name ASC
    `).bind(currentMonth, currentYear.toString(), currentYear.toString(), user.id).all();

    const result = budgets.results.map((b: any) => ({
      ...b,
      remaining: b.amount - b.spent,
      percentage: b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
    }));

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Budget GET error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Crea nuovo budget
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { category_id, amount, period = 'monthly' } = body;

    if (!category_id || !amount) {
      return new Response(JSON.stringify({ error: 'category_id e amount sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount deve essere positivo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if budget already exists for this category/period
    const existing = await db.prepare(`
      SELECT id FROM budgets
      WHERE user_id = ? AND category_id = ? AND period = ?
    `).bind(user.id, category_id, period).first();

    if (existing) {
      // Update existing
      await db.prepare(`
        UPDATE budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(amount, existing.id).run();

      return new Response(JSON.stringify({ success: true, id: existing.id, updated: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new
    const result = await db.prepare(`
      INSERT INTO budgets (user_id, category_id, amount, period)
      VALUES (?, ?, ?, ?)
    `).bind(user.id, category_id, amount, period).run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Budget POST error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
