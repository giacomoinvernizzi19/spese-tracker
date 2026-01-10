import type { APIRoute } from 'astro';
import { validatePassword, hashPassword } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = locals.runtime.env.DB as D1Database;

    const body = await request.json();
    const { token, password } = body;

    // Validate input
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token mancante' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!password) {
      return new Response(JSON.stringify({ error: 'Password mancante' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ error: passwordValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find token in database
    const resetToken = await db.prepare(`
      SELECT id, user_id, expires_at, used
      FROM password_reset_tokens
      WHERE token = ?
    `).bind(token).first<{
      id: string;
      user_id: string;
      expires_at: string;
      used: number;
    }>();

    // Token not found
    if (!resetToken) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token already used
    if (resetToken.used === 1) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token expired
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < new Date()) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await db.prepare(`
      UPDATE users SET password_hash = ? WHERE id = ?
    `).bind(passwordHash, resetToken.user_id).run();

    // Mark token as used
    await db.prepare(`
      UPDATE password_reset_tokens SET used = 1 WHERE id = ?
    `).bind(resetToken.id).run();

    // Optional: Delete all sessions for this user (force re-login)
    await db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(resetToken.user_id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Password aggiornata con successo'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(JSON.stringify({ error: 'Errore durante il reset' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
