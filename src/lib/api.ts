import type { APIRoute, APIContext } from 'astro';
import { getAuthUser, type User } from './auth';
import { InputError, record } from './validation';

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function body(request: Request) {
  try { return record(await request.json()); }
  catch (error) { if (error instanceof InputError) throw error; throw new InputError('JSON non valido'); }
}
type Handler = (context: APIContext, db: D1Database, user: User) => Promise<Response>;
export function authenticated(handler: Handler): APIRoute {
  return async context => {
    try {
      const db = context.locals.runtime.env.DB;
      const user = await getAuthUser(context.cookies,db);
      if (!user) return json({error:'Non autenticato'},401);
      return await handler(context,db,user);
    } catch (error) {
      if (error instanceof InputError) return json({error:error.message},error.status);
      console.error('Request failed', { path: new URL(context.request.url).pathname, kind: error instanceof Error ? error.name : 'UnknownError' });
      return json({error:'Operazione non riuscita. Riprova.'},500);
    }
  };
}
