import { authenticated, body, json } from '../../../lib/api';
import { InputError, ownedCategory, positiveId, text } from '../../../lib/validation';
export const prerender=false;
export const PUT=authenticated(async ({params,request},db,user)=>{
  const id=positiveId(params.id),input=await body(request);
  const current=await db.prepare('SELECT * FROM categories WHERE id=? AND user_id=?').bind(id,user.id).first();
  if(!current) throw new InputError('Categoria non trovata',404);
  const name=text(input.name ?? current.name).trim(),color=text(input.color ?? current.color),icon=text(input.icon ?? current.icon);
  if(!name || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new InputError('Nome o colore non valido');
  const parent=await ownedCategory(db,user.id,input.parent_id === undefined?current.parent_id:input.parent_id);
  if(parent){
    const target=await db.prepare('SELECT parent_id FROM categories WHERE id=? AND user_id=?').bind(parent,user.id).first();
    const children=await db.prepare('SELECT id FROM categories WHERE parent_id=? AND user_id=? LIMIT 1').bind(id,user.id).first();
    if(parent===id || target?.parent_id || children) throw new InputError('Gerarchia categorie non valida');
  }
  await db.prepare('UPDATE categories SET name=?,icon=?,color=?,parent_id=? WHERE id=? AND user_id=?').bind(name,icon,color,parent,id,user.id).run();
  return json({success:true});
});
export const DELETE=authenticated(async ({params},db,user)=>{
  const id=positiveId(params.id);
  const current=await ownedCategory(db,user.id,id);
  const inUse=await db.prepare(`SELECT 1 AS found FROM transactions WHERE category_id=? UNION ALL SELECT 1 FROM recurring_transactions WHERE category_id=? UNION ALL SELECT 1 FROM budgets WHERE category_id=? UNION ALL SELECT 1 FROM categories WHERE parent_id=? LIMIT 1`).bind(current,current,current,current).first();
  if(inUse) throw new InputError('Categoria utilizzata: riassegna prima i movimenti, budget o sottocategorie',409);
  await db.prepare('DELETE FROM categories WHERE id=? AND user_id=?').bind(id,user.id).run();
  return json({success:true});
});
