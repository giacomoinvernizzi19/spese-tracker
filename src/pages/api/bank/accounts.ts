import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';
import { createNordigenClient } from '../../../lib/nordigen';
import { safeDecrypt } from '../../../lib/encryption';

export const prerender = false;

// GET - Lista account bancari collegati
export const GET: APIRoute = async ({ cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;
  const encryptionKey = runtime.env.ENCRYPTION_KEY as string;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await db.prepare(`
      SELECT id, institution_id, institution_name, status, account_ids, last_sync_at, expires_at, created_at
      FROM bank_connections
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();

    // Decrypt account_ids for each connection
    const connections = await Promise.all(result.results.map(async (conn: any) => {
      let accountIds: string[] = [];
      if (conn.account_ids) {
        const decrypted = encryptionKey
          ? await safeDecrypt(conn.account_ids, encryptionKey)
          : conn.account_ids;
        accountIds = JSON.parse(decrypted);
      }
      return {
        ...conn,
        account_ids: accountIds
      };
    }));

    return new Response(JSON.stringify(connections), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Bank accounts error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Scollega un account bancario
export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;
  const encryptionKey = runtime.env.ENCRYPTION_KEY as string;

  // Auth check
  const user = await getAuthUser(cookies, db);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { connection_id } = body;

    if (!connection_id) {
      return new Response(JSON.stringify({ error: 'connection_id richiesto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify ownership
    const connection = await db.prepare(`
      SELECT requisition_id FROM bank_connections
      WHERE id = ? AND user_id = ?
    `).bind(connection_id, user.id).first();

    if (!connection) {
      return new Response(JSON.stringify({ error: 'Connessione non trovata' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Decrypt requisition_id if encrypted
    const requisitionId = encryptionKey
      ? await safeDecrypt(connection.requisition_id as string, encryptionKey)
      : connection.requisition_id as string;

    // Delete requisition from Nordigen (optional, best-effort)
    try {
      const client = createNordigenClient({
        NORDIGEN_SECRET_ID: runtime.env.NORDIGEN_SECRET_ID,
        NORDIGEN_SECRET_KEY: runtime.env.NORDIGEN_SECRET_KEY
      });
      await client.deleteRequisition(requisitionId);
    } catch (e) {
      // Ignore Nordigen errors - we'll delete locally anyway
      console.warn('Could not delete Nordigen requisition:', e);
    }

    // Delete from our database
    await db.prepare(`
      DELETE FROM bank_connections WHERE id = ? AND user_id = ?
    `).bind(connection_id, user.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Bank disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Errore nella disconnessione' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
