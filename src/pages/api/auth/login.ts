import type { APIRoute } from 'astro';
import { verifyPassword, createSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e password sono obbligatorie' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find user
    const user = await db.prepare(`
      SELECT id, email, password_hash, name
      FROM users
      WHERE email = ?
    `).bind(email.toLowerCase()).first<{
      id: string;
      email: string;
      password_hash: string;
      name: string;
    }>();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Email o password non corretti' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);

    if (!validPassword) {
      return new Response(JSON.stringify({ error: 'Email o password non corretti' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session
    await createSession(db, user.id, cookies);

    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Errore durante il login' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
