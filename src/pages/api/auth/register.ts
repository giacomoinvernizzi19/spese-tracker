import type { APIRoute } from 'astro';
import {
  hashPassword,
  generateUserId,
  createSession,
  createDefaultCategories,
  validateEmail,
  validatePassword,
  validateName
} from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Tutti i campi sono obbligatori' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email non valida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ error: passwordValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return new Response(JSON.stringify({ error: nameValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if email already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Questa email è già registrata' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create user
    const userId = generateUserId();
    const passwordHash = await hashPassword(password);

    await db.prepare(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email.toLowerCase(), passwordHash, name.trim()).run();

    // Create default categories for new user
    await createDefaultCategories(db, userId);

    // Create session
    await createSession(db, userId, cookies);

    return new Response(JSON.stringify({
      success: true,
      user: { id: userId, email: email.toLowerCase(), name: name.trim() }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ error: 'Errore durante la registrazione' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
