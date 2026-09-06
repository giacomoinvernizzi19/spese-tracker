import { ownedCategory } from './validation';
import type { Period } from './period';
export const monthNames=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
export async function categoryTotals(db:D1Database,userId:string,period:Period,parentId:string|null) {
  const parent=await ownedCategory(db,userId,parentId);
  const rows=await db.prepare(`SELECT c.id,c.name,c.icon,c.color,COALESCE(SUM(t.amount),0) amount,COUNT(t.id) count,
    (SELECT COUNT(*) FROM categories child WHERE child.parent_id=c.id AND child.user_id=c.user_id) hasChildren
    FROM categories c LEFT JOIN transactions t ON t.user_id=c.user_id AND t.type='expense' AND t.date>=? AND t.date<=?
      AND (t.category_id=c.id OR (? IS NULL AND t.category_id IN (SELECT id FROM categories WHERE parent_id=c.id AND user_id=c.user_id)))
    WHERE c.user_id=? AND c.parent_id IS ? GROUP BY c.id HAVING amount>0 ORDER BY amount DESC`).bind(period.from,period.to,parent,userId,parent).all();
  if(parent===null){
    const unassigned=await db.prepare("SELECT COALESCE(SUM(t.amount),0) amount,COUNT(*) count FROM transactions t WHERE t.user_id=? AND t.type='expense' AND t.date>=? AND t.date<=? AND NOT EXISTS(SELECT 1 FROM categories c WHERE c.id=t.category_id AND c.user_id=t.user_id)").bind(userId,period.from,period.to).first<{amount:number;count:number}>();
    if(unassigned && unassigned.amount>0)rows.results.push({id:0,name:'Senza categoria',icon:'',color:'#6B7280',hasChildren:0,...unassigned});
  }
  return rows.results.sort((a,b)=>Number(b.amount)-Number(a.amount));
}
