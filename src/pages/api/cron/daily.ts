import type { APIRoute } from 'astro';
import { generatePendingTransactions } from '../../../lib/recurring';

export const prerender = false;

// POST - Daily cron tasks (called by CF Cron Trigger or manually with secret)
export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;

  // Verify cron secret
  const cronSecret = locals.runtime.env.CRON_SECRET;
  const authHeader = request.headers.get('X-Cron-Secret');
  if (cronSecret && authHeader !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Generate recurring transactions for all users
    const generated = await generatePendingTransactions(db);
    results.recurring_generated = generated;

    // 2. Cleanup expired sessions
    const sessions = await db.prepare(
      `DELETE FROM sessions WHERE expires_at < datetime('now')`
    ).run();
    results.sessions_cleaned = sessions.meta.changes;

    // 3. Cleanup used/expired password reset tokens
    const tokens = await db.prepare(
      `DELETE FROM password_reset_tokens WHERE expires_at < datetime('now') OR used = 1`
    ).run();
    results.tokens_cleaned = tokens.meta.changes;

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Cron error:', error);
    return new Response(JSON.stringify({ error: 'Cron failed', details: String(error) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
