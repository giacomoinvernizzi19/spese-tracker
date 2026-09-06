import type { APIRoute } from 'astro';
import { runDaily } from '../../../lib/jobs';
import { json } from '../../../lib/api';
export const prerender=false;
export const POST:APIRoute=async({request,locals})=>{
  const env=locals.runtime.env;
  if(!env.CRON_SECRET || request.headers.get('X-Cron-Secret')!==env.CRON_SECRET)return json({error:'Unauthorized'},401);
  const results=await runDaily(env);
  const success=Object.values(results).every(result=>result.status!=='failed');
  return json({success,results},success?200:500);
};
