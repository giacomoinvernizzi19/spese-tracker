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

// POST - Nuova categoria
export const POST: APIRoute = async ({ request, cookies, locals }) => {
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
    const body = await request.json();
    const { name, icon = '📦', color = '#6B7280', parent_id = null } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await db.prepare(`
      INSERT INTO categories (user_id, name, icon, color, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, name, icon, color, parent_id).run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
