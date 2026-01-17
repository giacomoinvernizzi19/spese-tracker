import type { APIRoute } from 'astro';
import { validatePassword, hashPassword, timingSafeEqual } from '../../../lib/auth';

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
    // Note: Using timing-safe comparison for the token value
    const resetToken = await db.prepare(`
      SELECT id, user_id, token, expires_at, used
      FROM password_reset_tokens
      WHERE id IN (SELECT id FROM password_reset_tokens ORDER BY created_at DESC LIMIT 100)
    `).bind().all<{
      id: string;
      user_id: string;
      token: string;
      expires_at: string;
      used: number;
    }>();

    // Find matching token using timing-safe comparison
    let matchedToken: { id: string; user_id: string; token: string; expires_at: string; used: number } | null = null;
    for (const t of resetToken.results || []) {
      if (timingSafeEqual(t.token, token)) {
        matchedToken = t;
        break;
      }
    }

    // Token not found - use same error message for security
    if (!matchedToken) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Alias for compatibility with rest of code
    const tokenData = matchedToken;

    // Token already used
    if (tokenData.used === 1) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token expired
    const expiresAt = new Date(tokenData.expires_at);
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
    `).bind(passwordHash, tokenData.user_id).run();

    // Mark token as used
    await db.prepare(`
      UPDATE password_reset_tokens SET used = 1 WHERE id = ?
    `).bind(tokenData.id).run();

    // Delete all sessions for this user (force re-login)
    await db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(tokenData.user_id).run();

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
