import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';
import { createNordigenClient } from '../../../lib/nordigen';
import { encrypt } from '../../../lib/encryption';

export const prerender = false;

// POST - Avvia connessione OAuth con una banca
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const runtime = locals.runtime;
  const db = runtime.env.DB;

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
    const { institution_id, institution_name } = body;

    if (!institution_id) {
      return new Response(JSON.stringify({ error: 'institution_id richiesto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = createNordigenClient({
      NORDIGEN_SECRET_ID: runtime.env.NORDIGEN_SECRET_ID,
      NORDIGEN_SECRET_KEY: runtime.env.NORDIGEN_SECRET_KEY
    });

    // Generate unique connection ID
    const connectionId = crypto.randomUUID();
    const appUrl = runtime.env.APP_URL || 'https://spese-tracker.g-invernizzi-jm.workers.dev';
    const redirectUri = `${appUrl}/api/bank/callback`;

    // Create Nordigen requisition
    const requisition = await client.createRequisition(
      institution_id,
      redirectUri,
      connectionId // Use connection ID as reference
    );

    // Encrypt sensitive data before storing
    const encryptionKey = runtime.env.ENCRYPTION_KEY as string;
    const encryptedRequisitionId = encryptionKey
      ? await encrypt(requisition.id, encryptionKey)
      : requisition.id;

    // Save connection to database
    await db.prepare(`
      INSERT INTO bank_connections (id, user_id, provider, institution_id, institution_name, requisition_id, status)
      VALUES (?, ?, 'nordigen', ?, ?, ?, 'pending')
    `).bind(connectionId, user.id, institution_id, institution_name || null, encryptedRequisitionId).run();

    return new Response(JSON.stringify({
      link: requisition.link,
      connection_id: connectionId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Bank connect error:', error);
    return new Response(JSON.stringify({
      error: 'Errore nella connessione alla banca',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
