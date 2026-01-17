import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// PUT - Aggiorna budget
export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;

  try {
    // Verify budget belongs to user
    const budget = await db.prepare(`
      SELECT id FROM budgets WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();

    if (!budget) {
      return new Response(JSON.stringify({ error: 'Budget non trovato' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { amount, period } = body;

    if (amount !== undefined && amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount deve essere positivo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (amount !== undefined) {
      updates.push('amount = ?');
      values.push(amount);
    }
    if (period !== undefined) {
      updates.push('period = ?');
      values.push(period);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'Nessun campo da aggiornare' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(`
      UPDATE budgets SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Budget PUT error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Elimina budget
export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;

  try {
    // Verify budget belongs to user before deleting
    const result = await db.prepare(`
      DELETE FROM budgets WHERE id = ? AND user_id = ?
    `).bind(id, user.id).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Budget non trovato' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Budget DELETE error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
