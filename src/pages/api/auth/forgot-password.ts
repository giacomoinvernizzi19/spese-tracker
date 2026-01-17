import type { APIRoute } from 'astro';
import { validateEmail, generateResetToken, getResetTokenExpiry } from '../../../lib/auth';
import { checkRateLimit, getClientIP, rateLimitResponse } from '../../../lib/rate-limiter';
import { Resend } from 'resend';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = locals.runtime.env.DB as D1Database;
    const resendApiKey = locals.runtime.env.RESEND_API_KEY as string;

    const body = await request.json();
    const { email } = body;

    // Validate email format
    if (!email || !validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email non valida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting check
    const ip = getClientIP(request);
    const rateLimit = await checkRateLimit(db, 'forgot-password', ip, email);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds!);
    }

    // Find user by email
    const user = await db.prepare(`
      SELECT id, email, name FROM users WHERE email = ?
    `).bind(email.toLowerCase()).first<{ id: string; email: string; name: string }>();

    // Always return success to not reveal if email exists (security)
    if (!user) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Se l\'email esiste, riceverai un link di recupero'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete any existing tokens for this user
    await db.prepare(`
      DELETE FROM password_reset_tokens WHERE user_id = ?
    `).bind(user.id).run();

    // Generate new token
    const tokenId = crypto.randomUUID();
    const token = generateResetToken();
    const expiresAt = getResetTokenExpiry();

    // Save token to database
    await db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(tokenId, user.id, token, expiresAt).run();

    // Build reset URL
    const baseUrl = new URL(request.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email with Resend
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      await resend.emails.send({
        from: 'SpesaTracker <onboarding@resend.dev>',
        to: user.email,
        subject: 'Recupera la tua password - SpesaTracker',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="font-size: 48px;">💰</div>
              <h1 style="color: #2563eb; margin: 10px 0;">SpesaTracker</h1>
            </div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: #1e293b;">Ciao ${user.name},</h2>
              <p>Hai richiesto di recuperare la password del tuo account SpesaTracker.</p>
              <p>Clicca il pulsante qui sotto per impostare una nuova password:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Reimposta password
                </a>
              </div>

              <p style="color: #64748b; font-size: 14px;">
                Il link scade tra <strong>1 ora</strong>.
              </p>

              <p style="color: #64748b; font-size: 14px;">
                Se non riesci a cliccare il pulsante, copia e incolla questo link nel browser:<br>
                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>

            <div style="text-align: center; color: #94a3b8; font-size: 12px;">
              <p>Se non hai richiesto tu questo reset, ignora questa email.</p>
              <p>La tua password non verra modificata.</p>
            </div>
          </body>
          </html>
        `
      });
    } else {
      // No API key - log to console for development
      console.log('=== PASSWORD RESET (dev mode) ===');
      console.log(`Email: ${user.email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('================================');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Se l\'email esiste, riceverai un link di recupero'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(JSON.stringify({ error: 'Errore durante l\'invio' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
