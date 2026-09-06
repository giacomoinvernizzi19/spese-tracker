declare module '*dist/_worker.js/index.js' {
  const handler: {fetch(request:Request,env:WorkerEnv,context:import('@cloudflare/workers-types').ExecutionContext):Promise<Response>};
  export default handler;
}
