import type { APIRoute } from 'astro';
import { validatePassword, hashPassword, timingSafeEqual } from '../../../lib/auth';
import { checkRateLimit, getClientIP, rateLimitResponse } from '../../../lib/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = locals.runtime.env.DB as D1Database;

    // Rate limiting check by IP
    const ip = getClientIP(request);
    const rateLimit = await checkRateLimit(db, 'forgot-password', ip);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds!);
    }

    const body = await request.json();
    const { token, password } = body;

    // Validate input
    if (typeof token !== 'string' || !token) {
      return new Response(JSON.stringify({ error: 'Token mancante' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof password !== 'string' || !password) {
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

    // Find token in database using direct lookup
    // Note: Using indexed lookup for O(log n) performance
    const tokenData = await db.prepare(`
      SELECT id, user_id, token, expires_at, used
      FROM password_reset_tokens
      WHERE token = ?
    `).bind(token).first<{
      id: string;
      user_id: string;
      token: string;
      expires_at: string;
      used: number;
    }>();

    // Token not found - use same error message for security
    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify token matches using timing-safe comparison (extra security layer)
    if (!timingSafeEqual(tokenData.token, token)) {
      return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Recheck the token inside one transaction, so concurrent/replayed requests cannot reuse it.
    const validToken = "SELECT 1 FROM password_reset_tokens WHERE id = ? AND used = 0 AND julianday(expires_at) > julianday('now')";
    const results = await db.batch([
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ? AND EXISTS (${validToken})`).bind(passwordHash,tokenData.user_id,tokenData.id),
      db.prepare(`DELETE FROM sessions WHERE user_id = ? AND EXISTS (${validToken})`).bind(tokenData.user_id,tokenData.id),
      db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ? AND used = 0 AND julianday(expires_at) > julianday('now')").bind(tokenData.id),
    ]);
    if (!results[0].meta.changes) return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), { status: 400 });

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
