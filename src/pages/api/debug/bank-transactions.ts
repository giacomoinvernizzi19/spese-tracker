import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Debug: mostra tutte le transazioni bancarie
export const GET: APIRoute = async ({ cookies, locals }) => {
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
    // Get all bank transactions
    const bankTx = await db.prepare(`
      SELECT id, amount, type, description, date, source, external_id, bank_connection_id, category_id, created_at
      FROM transactions
      WHERE user_id = ? AND source = 'bank'
      ORDER BY date DESC
    `).bind(user.id).all();

    // Get all transactions for January 2026
    const janTx = await db.prepare(`
      SELECT id, amount, type, description, date, source, external_id, created_at
      FROM transactions
      WHERE user_id = ? AND date >= '2026-01-01' AND date <= '2026-01-31'
      ORDER BY date DESC
    `).bind(user.id).all();

    // Get transaction counts by source
    const countsBySource = await db.prepare(`
      SELECT source, COUNT(*) as count
      FROM transactions
      WHERE user_id = ?
      GROUP BY source
    `).bind(user.id).all();

    return new Response(JSON.stringify({
      bankTransactions: bankTx.results,
      bankCount: bankTx.results.length,
      januaryTransactions: janTx.results,
      januaryCount: janTx.results.length,
      countsBySource: countsBySource.results
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Errore query',
      details: error instanceof Error ? error.message : 'Unknown'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
