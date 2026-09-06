import { authenticated, body, json } from '../../../lib/api';
import { dateOnly, InputError, ownedCategory, positiveAmount, positiveId, text, transactionType } from '../../../lib/validation';
import { generatePendingTransactions } from '../../../lib/recurring';
export const prerender = false;

export const GET = authenticated(async (_context,db,user) => {
  const rows = await db.prepare(`SELECT r.*, c.name AS category_name,c.icon AS category_icon FROM recurring_transactions r LEFT JOIN categories c ON c.id=r.category_id AND c.user_id=r.user_id WHERE r.user_id=? ORDER BY r.active DESC,r.created_at DESC`).bind(user.id).all();
  return json(rows.results);
});
async function values(db: D1Database, userId: string, input: Record<string,unknown>) {
  const amount=positiveAmount(input.amount), type=transactionType(input.type), description=text(input.description);
  const category=await ownedCategory(db,userId,input.category_id);
  const start=dateOnly(input.start_date), end=input.end_date ? dateOnly(input.end_date) : null;
  if (end && end<start) throw new InputError('La data finale precede quella iniziale');
  const frequency=input.frequency;
  if (!['monthly','weekly','yearly'].includes(String(frequency))) throw new InputError('Frequenza non valida');
  const day=input.day_of_month ?? (frequency==='weekly' ? 1 : new Date(`${start}T00:00:00Z`).getUTCDate());
  if (typeof day!=='number' || !Number.isInteger(day) || day<(frequency==='weekly'?0:1) || day>(frequency==='weekly'?6:31)) throw new InputError('Giorno non valido');
  if (input.active!==undefined && typeof input.active!=='boolean') throw new InputError('Stato non valido');
  return [amount,type,description,category,frequency,day,start,end,input.active===false?0:1];
}
export const POST = authenticated(async ({request},db,user) => {
  const input=await body(request), data=await values(db,user.id,input);
  const result=await db.prepare('INSERT INTO recurring_transactions(user_id,amount,type,description,category_id,frequency,day_of_month,start_date,end_date,active) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(user.id,...data).run();
  // Generation has its own idempotency key. A failure does not falsely report success.
  try {
    const generated=await generatePendingTransactions(db,user.id);
    return json({success:true,id:result.meta.last_row_id,generated},201);
  } catch {
    return json({success:true,id:result.meta.last_row_id,generation_error:'Ricorrenza salvata. Generazione movimenti non completata: verrà ritentata senza duplicati.'},201);
  }
});
export const PUT = authenticated(async ({request},db,user) => {
  const input=await body(request), id=positiveId(input.id);
  const current=await db.prepare('SELECT * FROM recurring_transactions WHERE id=? AND user_id=?').bind(id,user.id).first<Record<string,unknown>>();
  if(!current) throw new InputError('Ricorrenza non trovata',404);
  const data=await values(db,user.id,{...current,active:Boolean(current.active),...input});
  await db.prepare('UPDATE recurring_transactions SET amount=?,type=?,description=?,category_id=?,frequency=?,day_of_month=?,start_date=?,end_date=?,active=? WHERE id=? AND user_id=?').bind(...data,id,user.id).run();
  return json({success:true});
});
export const DELETE = authenticated(async ({request},db,user) => {
  const id=positiveId((await body(request)).id);
  const result=await db.prepare('DELETE FROM recurring_transactions WHERE id=? AND user_id=?').bind(id,user.id).run();
  if(!result.meta.changes) throw new InputError('Ricorrenza non trovata',404);
  return json({success:true});
});
