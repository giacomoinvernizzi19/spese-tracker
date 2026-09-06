// Read-only production checks. No migrations, secrets, deployments or bank requests are performed.
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const config=ts.parseConfigFileTextToJson('wrangler.jsonc',readFileSync('wrangler.jsonc','utf8')).config;
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required; no changes made');
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worker:config.name,checks:[],blocking:[]};
if(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim())report.blocking.push('Working tree changes are not committed');
async function api(path,body){
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok||!data.success)throw new Error(`Cloudflare read failed (${response.status}); verify account/token permissions`);return data.result;
}
try{
  const settings=await api(`/workers/scripts/${config.name}/settings`);
  const db=config.d1_databases.find(binding=>binding.binding==='DB');
  const bound=settings.bindings?.find(binding=>binding.name==='DB');
  if(bound?.id!==db.database_id)report.blocking.push('Worker DB binding differs from reviewed configuration');
  const secrets=await api(`/workers/scripts/${config.name}/secrets`);
  const names=new Set(secrets.map(secret=>secret.name));
  const missing=['NORDIGEN_SECRET_ID','NORDIGEN_SECRET_KEY','ENCRYPTION_KEY','RESEND_API_KEY','CRON_SECRET'].filter(name=>!names.has(name));
  if(missing.length)report.blocking.push(`Missing secrets: ${missing.join(', ')}`);
  const schema=(await api(`/d1/database/${db.database_id}/query`,{sql:"SELECT name,sql FROM sqlite_master WHERE type IN ('table','index')"}))[0].results;
  const table=name=>schema.find(row=>row.name===name)?.sql ?? '';
  for(const [name,fields] of Object.entries({budgets:['period','month','year'],transactions:['recurring_id','occurrence_date','import_batch_id','import_row_id'],bank_sync_accounts:['covered_through'],bank_candidates:['candidate_key'],bank_request_gates:['retry_at'],job_state:['last_success_at']})){
    if(!fields.every(field=>table(name).includes(field)))report.blocking.push(`Schema not upgraded: ${name}`);
  }
  const migrations=readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort();
  if(!table('d1_migrations'))report.blocking.push('Migration tracking missing; reconcile verified historical baseline before apply');
  else{
    const applied=(await api(`/d1/database/${db.database_id}/query`,{sql:'SELECT name FROM d1_migrations'}))[0].results.map(row=>row.name);
    const pending=migrations.filter(name=>!applied.includes(name));if(pending.length)report.blocking.push(`Untracked migrations: ${pending.join(', ')}`);
  }
  report.checks.push('Correct account exposes configured Worker; settings, secret names and D1 schema read successfully');
  report.checks.push(`Bank automation configured ${config.vars.BANK_SYNC_ENABLED}; enable only after recorded manual live proof`);
}catch(error){report.blocking.push(error.message);}
console.info(JSON.stringify(report,null,2));
if(report.blocking.length)process.exitCode=1;
