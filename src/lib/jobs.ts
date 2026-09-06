import { generatePendingTransactions } from './recurring';
import { bankConfig,syncConnection,type BankConnection } from './bank';
export interface JobResult {status:'success'|'failed'|'busy'|'disabled';count?:number;}
async function runJob(db:D1Database,name:string,task:()=>Promise<number>):Promise<JobResult> {
  await db.prepare('INSERT INTO job_state(name) VALUES(?) ON CONFLICT DO NOTHING').bind(name).run();
  const token=crypto.randomUUID();
  const lease=await db.prepare("UPDATE job_state SET lease_token=?,lease_until=datetime('now','+15 minutes'),last_attempt_at=CURRENT_TIMESTAMP,status='running',error=NULL WHERE name=? AND (lease_until IS NULL OR julianday(lease_until)<julianday('now'))").bind(token,name).run();
  if(!lease.meta.changes)return {status:'busy'};
  try {
    const count=await task();
    const finished=await db.prepare("UPDATE job_state SET lease_token=NULL,lease_until=NULL,last_success_at=CURRENT_TIMESTAMP,status='success' WHERE name=? AND lease_token=?").bind(name,token).run();
    if(!finished.meta.changes)throw new Error('Job lease lost');
    return {status:'success',count};
  } catch {
    await db.prepare("UPDATE job_state SET lease_token=NULL,lease_until=NULL,status='failed',error='Esecuzione non completata; ritentare' WHERE name=? AND lease_token=?").bind(name,token).run();
    return {status:'failed'};
  }
}
export async function runDaily(env:WorkerEnv):Promise<Record<string,JobResult>> {
  const db=env.DB;
  const recurring=await runJob(db,'recurring',async()=>{
    const users=await db.prepare('SELECT DISTINCT user_id FROM recurring_transactions WHERE active=1').all<{user_id:string}>();
    let count=0,failed=false;
    for(const user of users.results){try{count+=await generatePendingTransactions(db,user.user_id);}catch{failed=true;}}
    if(failed)throw new Error('Recurring generation incomplete');
    return count;
  });
  const cleanup=await runJob(db,'cleanup',async()=>{
    const results=await db.batch([
      db.prepare("DELETE FROM sessions WHERE julianday(expires_at)<=julianday('now')"),
      db.prepare("DELETE FROM password_reset_tokens WHERE used=1 OR julianday(expires_at)<=julianday('now')"),
      db.prepare("DELETE FROM rate_limits WHERE julianday(last_attempt_at)<julianday('now','-7 days') AND (blocked_until IS NULL OR julianday(blocked_until)<julianday('now'))"),
    ]);
    return results.reduce((n,r)=>n+r.meta.changes,0);
  });
  const banking:JobResult=env.BANK_SYNC_ENABLED==='true'?await runJob(db,'banking',async()=>{
    const {client,key}=bankConfig(env);
    const rows=await db.prepare("SELECT * FROM bank_connections WHERE status='linked'").all<BankConnection>();
    let count=0,failed=false;
    for(const connection of rows.results){
      try{const result=await syncConnection(db,connection,client,key,undefined,new Date().toISOString().slice(0,10));count+=result.reduce((n,r)=>n+r.staged,0);if(result.some(r=>r.error))failed=true;}
      catch{failed=true;}
    }
    if(failed)throw new Error('Banking sync incomplete');return count;
  }):{status:'disabled'};
  return {recurring,cleanup,banking};
}
