import { authenticated, body, json } from '../../../lib/api';
import { InputError, ownedCategory, text } from '../../../lib/validation';
import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET - Lista categorie dell'utente
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
  const hierarchical = url.searchParams.get('hierarchical') === 'true';

  try {
    const result = await db.prepare(`
      SELECT id, name, icon, color, parent_id
      FROM categories
      WHERE user_id = ?
      ORDER BY name ASC
    `).bind(user.id).all();

    const categories = result.results as any[];

    // Se richiesto formato gerarchico, trasforma in albero
    if (hierarchical) {
      const rootCategories = categories.filter(c => !c.parent_id);
      const childrenMap: Record<number, any[]> = {};

      categories.forEach(c => {
        if (c.parent_id) {
          if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
          childrenMap[c.parent_id].push(c);
        }
      });

      const hierarchicalCategories = rootCategories.map(cat => ({
        ...cat,
        children: childrenMap[cat.id] || []
      }));

      return new Response(JSON.stringify(hierarchicalCategories), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(categories), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST = authenticated(async ({request},db,user) => {
  const input=await body(request);
  const name=text(input.name).trim();
  if(!name) throw new InputError('Nome obbligatorio');
  const parent=await ownedCategory(db,user.id,input.parent_id);
  if(parent){
    const row=await db.prepare('SELECT parent_id FROM categories WHERE id=? AND user_id=?').bind(parent,user.id).first();
    if(row?.parent_id) throw new InputError('Scegli una categoria principale');
  }
  const color=text(input.color,'#6B7280');
  if(!/^#[0-9a-fA-F]{6}$/.test(color)) throw new InputError('Colore non valido');
  const icon=text(input.icon,'');
  const result=await db.prepare('INSERT INTO categories(user_id,name,icon,color,parent_id) VALUES(?,?,?,?,?)').bind(user.id,name,icon,color,parent).run();
  return json({success:true,id:result.meta.last_row_id},201);
});
