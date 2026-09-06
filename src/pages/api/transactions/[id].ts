import { authenticated, body, json } from '../../../lib/api';
import { InputError, positiveId } from '../../../lib/validation';
import { transactionValues } from '../../../lib/transactions';
export const prerender = false;
export const DELETE = authenticated(async ({params},db,user) => {
  const result=await db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').bind(positiveId(params.id),user.id).run();
  if(!result.meta.changes) throw new InputError('Transazione non trovata',404);
  return json({success:true});
});
export const PUT = authenticated(async ({params,request},db,user) => {
  const id=positiveId(params.id);
  const current=await db.prepare('SELECT * FROM transactions WHERE id=? AND user_id=?').bind(id,user.id).first<Record<string,unknown>>();
  if(!current) throw new InputError('Transazione non trovata',404);
  const input=await body(request),v=await transactionValues(db,user.id,{...current,...input});
  await db.prepare('UPDATE transactions SET amount=?,type=?,category_id=?,description=?,date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(v.amount,v.type,v.category_id,v.description,v.date,id,user.id).run();
  return json({success:true});
});
