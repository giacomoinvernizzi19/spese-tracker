import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  try {
    await deleteSession(cookies, db);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({ error: 'Errore durante il logout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
