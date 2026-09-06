import { authenticated,body,json } from '../../../lib/api';
import { InputError,positiveId } from '../../../lib/validation';
export const prerender=false;
interface Candidate {id:number;user_id:string;amount:number;type:string;date:string;description:string;external_id:string|null;connection_id:string;status:string;}
export const GET=authenticated(async(_context,db,user)=>{
  const rows=await db.prepare("SELECT id,amount,type,date,description,reason FROM bank_candidates WHERE user_id=? AND status='pending' ORDER BY date DESC,id DESC LIMIT 100").bind(user.id).all();
  const items=[];
  for(const row of rows.results) {
    const matches=await db.prepare('SELECT id,description,source FROM transactions WHERE user_id=? AND amount=? AND type=? AND date=? ORDER BY id LIMIT 10').bind(user.id,row.amount,row.type,row.date).all();
    items.push({...row,matches:matches.results});
  }
  const total=await db.prepare("SELECT COUNT(*) n FROM bank_candidates WHERE user_id=? AND status='pending'").bind(user.id).first<{n:number}>();
  return json({items,total:total?.n ?? 0});
});
export const POST=authenticated(async({request},db,user)=>{
  const input=await body(request),id=positiveId(input.id);
  if(!['import','link','ignore'].includes(String(input.action)))throw new InputError('Azione non valida');
  const row=await db.prepare('SELECT * FROM bank_candidates WHERE id=? AND user_id=?').bind(id,user.id).first<Candidate>();
  if(!row)throw new InputError('Movimento non trovato',404);
  if(row.status!=='pending')return json({success:true,already_resolved:true});
  if(input.action==='ignore') {
    await db.prepare("UPDATE bank_candidates SET status='ignored' WHERE id=? AND user_id=? AND status='pending'").bind(id,user.id).run();
  } else if(input.action==='link') {
    const target=positiveId(input.transaction_id);
    const existing=await db.prepare('SELECT id FROM transactions WHERE id=? AND user_id=? AND amount=? AND type=? AND date=?').bind(target,user.id,row.amount,row.type,row.date).first();
    if(!existing)throw new InputError('Spesa da associare non corrispondente');
    await db.prepare("UPDATE bank_candidates SET status='linked',transaction_id=? WHERE id=? AND user_id=? AND status='pending'").bind(target,id,user.id).run();
  } else {
    if(!row.external_id && input.confirm_unverified!==true)throw new InputError('Conferma richiesta: identità bancaria non verificata');
    const external=row.external_id ?? `reviewed-candidate:${id}`;
    await db.batch([
      db.prepare(`INSERT INTO transactions(user_id,amount,type,date,description,source,external_id,bank_connection_id) SELECT user_id,amount,type,date,description,'bank',?,connection_id FROM bank_candidates WHERE id=? AND user_id=? AND status='pending' ON CONFLICT(user_id,external_id) WHERE external_id IS NOT NULL DO NOTHING`).bind(external,id,user.id),
      db.prepare("UPDATE bank_candidates SET status='imported',transaction_id=(SELECT id FROM transactions WHERE user_id=? AND external_id=?) WHERE id=? AND user_id=? AND status='pending'").bind(user.id,external,id,user.id),
    ]);
  }
  return json({success:true});
});
