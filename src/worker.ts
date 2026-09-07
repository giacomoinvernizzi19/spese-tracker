// Astro generates this module during the build, before Wrangler bundles the entrypoint.
import astro from '../dist/_worker.js/index.js';
import { guardWorker } from './lib/worker-boundary';
import { runDaily } from './lib/jobs';
export default guardWorker({
  fetch: astro.fetch.bind(astro),
  async scheduled(_event:unknown,env:WorkerEnv) {
    const results=await runDaily(env);
    if(Object.values(results).some(result=>result.status==='failed'))throw new Error('Scheduled jobs incomplete');
  },
});
