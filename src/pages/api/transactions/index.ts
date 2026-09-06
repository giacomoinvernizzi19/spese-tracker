import { authenticated, body, json } from '../../../lib/api';
import { createTransaction } from '../../../lib/transactions';
import { periodFrom } from '../../../lib/period';
import { InputError } from '../../../lib/validation';
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
  const limit = Number(url.searchParams.get('limit') || '100');
  const offset=Number(url.searchParams.get('offset') || '0');
  if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0)return json({error:'Paginazione non valida'},400);
  if(from||to||month||year){try{periodFrom(url.searchParams);}catch(error){return json({error:error instanceof InputError?error.message:'Periodo non valido'},400);}}

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
    LEFT JOIN categories c ON t.category_id = c.id AND c.user_id=t.user_id
    WHERE t.user_id = ?
  `;

  const params: (string|number)[] = [user.id];
  const before=url.searchParams.get('before_id'),order=url.searchParams.get('order');
  if(before){const id=Number(before);if(!Number.isSafeInteger(id)||id<1)return json({error:'Cursore non valido'},400);query+=' AND t.id<?';params.push(id);}


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

  query += order==='id'?' ORDER BY t.id DESC LIMIT ? OFFSET ?':' ORDER BY t.date DESC, t.created_at DESC,t.id DESC LIMIT ? OFFSET ?';
  params.push(limit,offset);

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

// POST - Manual and file imports share validation and persistence.
export const POST = authenticated(async ({request},db,user) => {
  const result=await createTransaction(db,user.id,await body(request));
  return json({success:true,...result},result.duplicate?200:201);
});
