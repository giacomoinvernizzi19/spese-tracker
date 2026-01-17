import type { APIRoute } from 'astro';
import { createNordigenClient } from '../../../lib/nordigen';
import { encrypt, safeDecrypt } from '../../../lib/encryption';

export const prerender = false;

// GET - Callback OAuth dalla banca
export const GET: APIRoute = async ({ request, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;
  const appUrl = runtime.env.APP_URL || 'https://spese-tracker.g-invernizzi-jm.workers.dev';
  const encryptionKey = runtime.env.ENCRYPTION_KEY as string;

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref'); // Connection ID we passed as reference

  if (!ref) {
    return Response.redirect(`${appUrl}/banche?status=error&message=missing_reference`, 302);
  }

  try {
    // Find connection by ID
    const connection = await db.prepare(`
      SELECT * FROM bank_connections WHERE id = ?
    `).bind(ref).first();

    if (!connection) {
      return Response.redirect(`${appUrl}/banche?status=error&message=connection_not_found`, 302);
    }

    const client = createNordigenClient({
      NORDIGEN_SECRET_ID: runtime.env.NORDIGEN_SECRET_ID,
      NORDIGEN_SECRET_KEY: runtime.env.NORDIGEN_SECRET_KEY
    });

    // Encryption is required
    if (!encryptionKey) {
      console.error('ENCRYPTION_KEY not configured');
      return Response.redirect(`${appUrl}/banche?status=error&message=server_config`, 302);
    }

    // Decrypt requisition_id
    const requisitionId = await safeDecrypt(connection.requisition_id as string, encryptionKey);

    // Get requisition status from Nordigen
    const requisition = await client.getRequisition(requisitionId);

    if (requisition.status === 'LN' && requisition.accounts?.length > 0) {
      // Encrypt account IDs before storing (encryptionKey already validated above)
      const accountIdsJson = JSON.stringify(requisition.accounts);
      const encryptedAccountIds = await encrypt(accountIdsJson, encryptionKey);

      // Success - linked and has accounts
      await db.prepare(`
        UPDATE bank_connections
        SET status = 'linked',
            account_ids = ?,
            expires_at = datetime('now', '+90 days')
        WHERE id = ?
      `).bind(encryptedAccountIds, ref).run();

      return Response.redirect(`${appUrl}/banche?status=success`, 302);
    } else if (requisition.status === 'EX') {
      // Expired
      await db.prepare(`
        UPDATE bank_connections SET status = 'expired' WHERE id = ?
      `).bind(ref).run();

      return Response.redirect(`${appUrl}/banche?status=error&message=expired`, 302);
    } else if (requisition.status === 'RJ') {
      // Rejected
      await db.prepare(`
        UPDATE bank_connections SET status = 'error' WHERE id = ?
      `).bind(ref).run();

      return Response.redirect(`${appUrl}/banche?status=error&message=rejected`, 302);
    } else {
      // Other status (pending, etc)
      return Response.redirect(`${appUrl}/banche?status=pending`, 302);
    }
  } catch (error) {
    console.error('Bank callback error:', error);
    return Response.redirect(`${appUrl}/banche?status=error&message=api_error`, 302);
  }
};
