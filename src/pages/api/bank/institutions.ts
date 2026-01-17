import type { APIRoute } from 'astro';
import { getAuthUser } from '../../../lib/auth';
import { createNordigenClient } from '../../../lib/nordigen';

export const prerender = false;

// GET - Lista banche italiane disponibili
export const GET: APIRoute = async ({ request, cookies, locals }) => {
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

  const url = new URL(request.url);
  const country = url.searchParams.get('country') || 'IT';

  try {
    // Check if secrets are configured
    if (!runtime.env.NORDIGEN_SECRET_ID || !runtime.env.NORDIGEN_SECRET_KEY) {
      console.error('Nordigen secrets not configured:', {
        hasSecretId: !!runtime.env.NORDIGEN_SECRET_ID,
        hasSecretKey: !!runtime.env.NORDIGEN_SECRET_KEY
      });
      return new Response(JSON.stringify({
        error: 'Nordigen non configurato',
        details: 'I secrets Nordigen non sono stati configurati'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = createNordigenClient({
      NORDIGEN_SECRET_ID: runtime.env.NORDIGEN_SECRET_ID,
      NORDIGEN_SECRET_KEY: runtime.env.NORDIGEN_SECRET_KEY
    });

    const institutions = await client.getInstitutions(country);

    // Check if response is an array
    if (!Array.isArray(institutions)) {
      console.error('Nordigen returned non-array:', institutions);
      return new Response(JSON.stringify({
        error: 'Risposta invalida da Nordigen',
        details: JSON.stringify(institutions)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return simplified institution list
    const simplified = institutions.map(inst => ({
      id: inst.id,
      name: inst.name,
      logo: inst.logo,
      bic: inst.bic
    }));

    return new Response(JSON.stringify(simplified), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Nordigen institutions error:', error);
    return new Response(JSON.stringify({
      error: 'Errore nel recupero delle banche',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
