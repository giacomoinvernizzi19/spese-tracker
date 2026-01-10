import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Statistiche per dashboard
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
  const month = url.searchParams.get('month') || (new Date().getMonth() + 1).toString();
  const year = url.searchParams.get('year') || new Date().getFullYear().toString();

  try {
    // Totale mese corrente
    const totalMonth = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
      AND type = 'expense'
    `).bind(user.id, month.padStart(2, '0'), year).first();

    // Spese per categoria nel mese
    const byCategory = await db.prepare(`
      SELECT
        c.name,
        c.icon,
        c.color,
        COALESCE(SUM(t.amount), 0) as amount
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
        AND strftime('%m', t.date) = ?
        AND strftime('%Y', t.date) = ?
        AND t.type = 'expense'
      WHERE c.user_id = ?
      GROUP BY c.id
      HAVING amount > 0
      ORDER BY amount DESC
    `).bind(month.padStart(2, '0'), year, user.id).all();

    // Ultimi 6 mesi - calcola la data 6 mesi fa in JS
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const monthlyTrend = await db.prepare(`
      SELECT
        strftime('%m', date) as month,
        strftime('%Y', date) as year,
        SUM(amount) as amount
      FROM transactions
      WHERE user_id = ? AND type = 'expense'
        AND date >= ?
      GROUP BY strftime('%Y-%m', date)
      ORDER BY year, month
    `).bind(user.id, sixMonthsAgoStr).all();

    // Formatta mesi
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const formattedTrend = monthlyTrend.results.map((m: any) => ({
      month: monthNames[parseInt(m.month) - 1],
      amount: m.amount
    }));

    return new Response(JSON.stringify({
      totalMonth: totalMonth?.total || 0,
      byCategory: byCategory.results,
      monthlyTrend: formattedTrend
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
