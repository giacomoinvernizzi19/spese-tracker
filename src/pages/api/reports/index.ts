import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Dati per report avanzati
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
  const year = url.searchParams.get('year') || new Date().getFullYear().toString();

  try {
    // Spese per mese dell'anno selezionato
    const monthlyData = await db.prepare(`
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
      FROM transactions
      WHERE user_id = ? AND strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).bind(user.id, year).all();

    // Spese per categoria dell'anno
    const categoryData = await db.prepare(`
      SELECT
        c.name,
        c.icon,
        c.color,
        SUM(t.amount) as amount,
        COUNT(t.id) as count
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
        AND strftime('%Y', t.date) = ?
        AND t.type = 'expense'
      WHERE c.user_id = ?
      GROUP BY c.id
      HAVING amount > 0
      ORDER BY amount DESC
    `).bind(year, user.id).all();

    // Confronto anno precedente
    const prevYear = (parseInt(year) - 1).toString();
    const yearComparison = await db.prepare(`
      SELECT
        strftime('%Y', date) as year,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
      FROM transactions
      WHERE user_id = ? AND strftime('%Y', date) IN (?, ?)
      GROUP BY strftime('%Y', date)
    `).bind(user.id, year, prevYear).all();

    // Top 10 spese più alte dell'anno
    const topExpenses = await db.prepare(`
      SELECT
        t.amount,
        t.description,
        t.date,
        c.name as category_name,
        c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND strftime('%Y', t.date) = ?
        AND t.type = 'expense'
      ORDER BY t.amount DESC
      LIMIT 10
    `).bind(user.id, year).all();

    // Media spese giornaliere per mese - query semplificata
    // Calcola: totale spese del mese / giorni con spese nel mese
    const dailyAverage = await db.prepare(`
      SELECT
        strftime('%m', date) as month,
        CAST(SUM(amount) AS REAL) / COUNT(DISTINCT date) as avg_daily
      FROM transactions
      WHERE user_id = ? AND strftime('%Y', date) = ? AND type = 'expense'
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).bind(user.id, year).all();

    // Anni disponibili per il filtro
    const availableYears = await db.prepare(`
      SELECT DISTINCT strftime('%Y', date) as year
      FROM transactions
      WHERE user_id = ?
      ORDER BY year DESC
    `).bind(user.id).all();

    // Formatta i mesi
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    const formattedMonthly = monthlyData.results.map((m: any) => ({
      month: monthNames[parseInt(m.month) - 1],
      monthNum: m.month,
      expenses: m.expenses || 0,
      income: m.income || 0
    }));

    const formattedDailyAvg = dailyAverage.results.map((m: any) => ({
      month: monthNames[parseInt(m.month) - 1],
      avgDaily: Math.round(m.avg_daily * 100) / 100
    }));

    return new Response(JSON.stringify({
      year,
      monthly: formattedMonthly,
      categories: categoryData.results,
      yearComparison: yearComparison.results,
      topExpenses: topExpenses.results,
      dailyAverage: formattedDailyAvg,
      availableYears: availableYears.results.map((y: any) => y.year)
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
