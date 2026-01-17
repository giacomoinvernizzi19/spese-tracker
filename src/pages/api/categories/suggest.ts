import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';

export const prerender = false;

// GET /api/categories/suggest?description=netflix
// Suggests a category based on transaction history
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
  const description = url.searchParams.get('description')?.trim().toLowerCase();

  if (!description || description.length < 2) {
    return new Response(JSON.stringify({ suggestion: null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Strategy 1: Find exact or partial match in past transactions
    const similarTransaction = await db.prepare(`
      SELECT t.category_id, c.name as category_name, c.icon as category_icon, COUNT(*) as match_count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
        AND LOWER(t.description) LIKE ?
      GROUP BY t.category_id
      ORDER BY match_count DESC
      LIMIT 1
    `).bind(user.id, `%${description}%`).first();

    if (similarTransaction) {
      return new Response(JSON.stringify({
        suggestion: {
          category_id: similarTransaction.category_id,
          category_name: similarTransaction.category_name,
          category_icon: similarTransaction.category_icon,
          confidence: 'high',
          reason: 'history'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Strategy 2: Match by category name keywords
    const categories = await db.prepare(`
      SELECT id, name, icon FROM categories WHERE user_id = ?
    `).bind(user.id).all();

    for (const cat of categories.results as any[]) {
      const catNameLower = cat.name.toLowerCase();
      // Check if description contains category name or vice versa
      if (description.includes(catNameLower) || catNameLower.includes(description)) {
        return new Response(JSON.stringify({
          suggestion: {
            category_id: cat.id,
            category_name: cat.name,
            category_icon: cat.icon,
            confidence: 'medium',
            reason: 'keyword'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // No match found
    return new Response(JSON.stringify({ suggestion: null }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Category suggest error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
