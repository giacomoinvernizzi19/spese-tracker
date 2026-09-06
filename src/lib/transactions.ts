import { dateOnly, InputError, ownedCategory, positiveAmount, text, transactionType } from './validation';

export async function transactionValues(db: D1Database,userId: string,input: Record<string,unknown>) {
  return { amount:positiveAmount(input.amount), type:transactionType(input.type), description:text(input.description), date:dateOnly(input.date), category_id:await ownedCategory(db,userId,input.category_id) };
}
export async function createTransaction(db: D1Database,userId: string,input: Record<string,unknown>) {
  const value=await transactionValues(db,userId,input);
  const source=input.source ?? 'manual';
  if(source!=='manual' && source!=='import') throw new InputError('Origine non valida');
  const batch=source==='import'?text(input.import_batch_id):null;
  const row=source==='import'?input.import_row_id:null;
  if(source==='import' && (!batch || !/^[a-f0-9]{64}$/.test(batch) || typeof row!=='number' || !Number.isSafeInteger(row) || row<0)) throw new InputError('Identità della riga importata non valida');
  const result=await db.prepare(`INSERT INTO transactions(user_id,amount,type,description,category_id,date,source,import_batch_id,import_row_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,import_batch_id,import_row_id) WHERE import_batch_id IS NOT NULL DO NOTHING`).bind(userId,value.amount,value.type,value.description,value.category_id,value.date,source,batch,row).run();
  if(!result.meta.changes){
    const existing=await db.prepare('SELECT * FROM transactions WHERE user_id=? AND import_batch_id=? AND import_row_id=?').bind(userId,batch,row).first<Record<string,unknown>>();
    if(!existing || Object.entries(value).some(([key,v])=>existing[key]!==v)) throw new InputError('Questa riga è già stata importata con dati diversi',409);
    return {id:existing.id,duplicate:true};
  }
  return {id:result.meta.last_row_id,duplicate:false};
}
