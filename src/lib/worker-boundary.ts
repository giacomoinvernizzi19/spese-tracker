// The app uses plain images and client islands; these server features are disabled.
export function disabledFrameworkRoute(url: string): boolean {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return /^\/(?:_image|_server-islands)(?:\/|$)/.test(path);
  } catch {
    return true;
  }
}

type WorkerHandlers = {
  fetch: (request: Request, env: WorkerEnv, context: unknown) => Response | Promise<Response>;
  scheduled: (event: unknown, env: WorkerEnv) => Promise<void>;
};
export function guardWorker(handlers: WorkerHandlers): WorkerHandlers {
  return {
    fetch(request, env, context) {
      if (env.MAINTENANCE_MODE === 'true') {
        return new Response('Manutenzione in corso. Riprova tra qualche minuto.', {
          status: 503,
          headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      if (disabledFrameworkRoute(request.url)) return new Response('Not found', { status: 404 });
      return handlers.fetch(request, env, context);
    },
    async scheduled(event, env) {
      if (env.MAINTENANCE_MODE === 'true') return;
      await handlers.scheduled(event, env);
    },
  };
}
