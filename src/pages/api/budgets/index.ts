import { authenticated, body, json } from '../../../lib/api';
import { periodFrom } from '../../../lib/period';
import { InputError, ownedCategory, positiveAmount } from '../../../lib/validation';
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
  if (!['monthly', 'yearly'].includes(period)) return new Response(JSON.stringify({ error: 'Periodo non valido' }), { status: 400 });

  try {
    // Get current month/year for spending calculation
    const selected=periodFrom(url.searchParams,period==='yearly');
    const currentMonth=selected.month,currentYear=selected.year;

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
      WHERE b.user_id = ? AND b.period = ?
        AND (
          (b.year = ? AND b.month = ?)
          OR (b.year IS NULL AND b.month IS NULL AND NOT EXISTS (
            SELECT 1 FROM budgets dated WHERE dated.user_id = b.user_id
              AND dated.category_id IS b.category_id AND dated.period = b.period
              AND dated.year = ? AND dated.month = ?
          ))
        )
      ORDER BY c.name ASC
    `).bind(currentMonth, currentYear.toString(), currentYear.toString(), user.id, period, currentYear, currentMonth, currentYear, currentMonth).all();

    const result = budgets.results.map((b: any) => ({
      ...b,
      remaining: b.amount - b.spent,
      percentage: b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
    }));

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if(error instanceof InputError)return json({error:error.message},error.status);
    console.error('Budget GET failed');
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST = authenticated(async ({request},db,user) => {
  const input=await body(request), amount=positiveAmount(input.amount), category=await ownedCategory(db,user.id,input.category_id);
  if(!category) throw new InputError('Categoria obbligatoria');
  const period=input.period ?? 'monthly';
  if(period!=='monthly' && period!=='yearly') throw new InputError('Periodo non valido');
  await db.prepare('INSERT INTO budgets(user_id,category_id,amount,period) VALUES(?,?,?,?) ON CONFLICT DO UPDATE SET amount=excluded.amount,updated_at=CURRENT_TIMESTAMP').bind(user.id,category,amount,period).run();
  const existing=await db.prepare('SELECT id FROM budgets WHERE user_id=? AND category_id=? AND period=? AND year IS NULL AND month IS NULL').bind(user.id,category,period).first();
  return json({success:true,id:existing?.id});
});
