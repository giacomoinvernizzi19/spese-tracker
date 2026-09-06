import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
const reservation=createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
const origin=`http://localhost:${port}`;
const state=mkdtempSync(join(tmpdir(),'thinkin-smoke-'));
const cli=join(process.cwd(),'node_modules/.bin/wrangler');
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
execFileSync(cli,['d1','migrations','apply','spese-tracker-db','--local','--persist-to',state],{env,stdio:'pipe'});
const server=spawn(cli,['dev','--local','--port',String(port),'--test-scheduled','--persist-to',state],{env,stdio:'pipe'});
let output='';server.stdout.on('data',chunk=>{output+=chunk;});server.stderr.on('data',chunk=>{output+=chunk;});
try{
  let ready=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw new Error('Local worker stopped');
    if(!output.includes(`Ready on ${origin}`)){await new Promise(resolve=>setTimeout(resolve,500));continue;}
    try{const response=await fetch(`${origin}/login/`);if(response.status===200){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Local worker did not start');
  assert.equal((await fetch(`${origin}/api/transactions`)).status,401);
  assert.equal((await fetch(`${origin}/api/cron/daily`,{method:'POST',headers:{'Content-Type':'application/json'}})).status,401);
  assert.equal((await fetch(`${origin}/__scheduled`)).status,200);
  const result=execFileSync(cli,['d1','execute','spese-tracker-db','--local','--persist-to',state,'--json','--command',"SELECT COUNT(*) n FROM job_state WHERE status='success'"],{env,encoding:'utf8'});
  assert.equal(JSON.parse(result)[0].results[0].n,2);
  console.info('PASS: Worker fetch routing, auth, protected cron and scheduled execution');
}catch(error){console.error(output.replace(/Bearer\s+\S+/g,'Bearer [redacted]'));throw error;}
finally{if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}rmSync(state,{recursive:true,force:true});}
