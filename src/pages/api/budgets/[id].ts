import { authenticated, body, json } from '../../../lib/api';
import { InputError, positiveAmount, positiveId } from '../../../lib/validation';
export const prerender=false;
export const PUT=authenticated(async ({params,request},db,user)=>{
  const id=positiveId(params.id),input=await body(request);
  const current=await db.prepare('SELECT * FROM budgets WHERE id=? AND user_id=?').bind(id,user.id).first();
  if(!current) throw new InputError('Budget non trovato',404);
  const amount=positiveAmount(input.amount ?? current.amount),period=input.period ?? current.period;
  if(period!=='monthly' && period!=='yearly') throw new InputError('Periodo non valido');
  if(current.year!==null && period!==current.period) throw new InputError('Un budget datato mantiene il proprio periodo');
  const duplicate=await db.prepare('SELECT id FROM budgets WHERE user_id=? AND category_id IS ? AND period=? AND year IS ? AND month IS ? AND id<>?').bind(user.id,current.category_id,period,current.year,current.month,id).first();
  if(duplicate) throw new InputError('Esiste già un budget per questo periodo',409);
  await db.prepare('UPDATE budgets SET amount=?,period=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(amount,period,id,user.id).run();
  return json({success:true});
});
export const DELETE=authenticated(async ({params},db,user)=>{
  const result=await db.prepare('DELETE FROM budgets WHERE id=? AND user_id=?').bind(positiveId(params.id),user.id).run();
  if(!result.meta.changes) throw new InputError('Budget non trovato',404);
  return json({success:true});
});
