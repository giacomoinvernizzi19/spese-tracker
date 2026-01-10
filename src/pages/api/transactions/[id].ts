import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// DELETE - Elimina transazione
export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;
  const { id } = params;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Only delete if belongs to user
    await db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
      .bind(id, user.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Modifica transazione
export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;
  const { id } = params;

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
    const { amount, category_id, description, date } = body;

    // Verify transaction belongs to user
    const existing = await db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?')
      .bind(id, user.id).first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Transazione non trovata' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify category belongs to user
    if (category_id) {
      const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
        .bind(category_id, user.id).first();

      if (!category) {
        return new Response(JSON.stringify({ error: 'Categoria non valida' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    await db.prepare(`
      UPDATE transactions
      SET amount = ?, category_id = ?, description = ?, date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(amount, category_id, description || '', date, id, user.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
