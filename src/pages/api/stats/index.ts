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
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const parentId = url.searchParams.get('parentId'); // Per drill-down sottocategorie

  // Use date range if provided, otherwise month/year
  const useRange = from && to;

  try {
    // Totale periodo
    let totalMonth;
    if (useRange) {
      totalMonth = await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND date >= ? AND date <= ? AND type = 'expense'
      `).bind(user.id, from, to).first();
    } else {
      totalMonth = await db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
        AND type = 'expense'
      `).bind(user.id, month.padStart(2, '0'), year).first();
    }

    // Spese per categoria
    let byCategory;
    if (parentId) {
      if (useRange) {
        byCategory = await db.prepare(`
          SELECT
            c.id, c.name, c.icon, c.color,
            COALESCE(SUM(t.amount), 0) as amount,
            0 as hasChildren
          FROM categories c
          LEFT JOIN transactions t ON c.id = t.category_id
            AND t.date >= ? AND t.date <= ? AND t.type = 'expense'
          WHERE c.parent_id = ?
          GROUP BY c.id
          HAVING amount > 0
          ORDER BY amount DESC
        `).bind(from, to, parentId).all();
      } else {
        byCategory = await db.prepare(`
          SELECT
            c.id, c.name, c.icon, c.color,
            COALESCE(SUM(t.amount), 0) as amount,
            0 as hasChildren
          FROM categories c
          LEFT JOIN transactions t ON c.id = t.category_id
            AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?
            AND t.type = 'expense'
          WHERE c.parent_id = ?
          GROUP BY c.id
          HAVING amount > 0
          ORDER BY amount DESC
        `).bind(month.padStart(2, '0'), year, parentId).all();
      }
    } else {
      if (useRange) {
        byCategory = await db.prepare(`
          SELECT * FROM (
            SELECT
              parent.id, parent.name, parent.icon, parent.color,
              (
                SELECT COALESCE(SUM(t.amount), 0)
                FROM transactions t
                WHERE t.type = 'expense'
                  AND t.date >= ? AND t.date <= ?
                  AND (t.category_id = parent.id
                    OR t.category_id IN (SELECT id FROM categories WHERE parent_id = parent.id))
              ) as amount,
              (SELECT COUNT(*) FROM categories WHERE parent_id = parent.id) as hasChildren
            FROM categories parent
            WHERE parent.user_id = ? AND parent.parent_id IS NULL
          ) WHERE amount > 0
          ORDER BY amount DESC
        `).bind(from, to, user.id).all();
      } else {
        byCategory = await db.prepare(`
          SELECT * FROM (
            SELECT
              parent.id, parent.name, parent.icon, parent.color,
              (
                SELECT COALESCE(SUM(t.amount), 0)
                FROM transactions t
                WHERE t.type = 'expense'
                  AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?
                  AND (t.category_id = parent.id
                    OR t.category_id IN (SELECT id FROM categories WHERE parent_id = parent.id))
              ) as amount,
              (SELECT COUNT(*) FROM categories WHERE parent_id = parent.id) as hasChildren
            FROM categories parent
            WHERE parent.user_id = ? AND parent.parent_id IS NULL
          ) WHERE amount > 0
          ORDER BY amount DESC
        `).bind(month.padStart(2, '0'), year, user.id).all();
      }
    }

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
