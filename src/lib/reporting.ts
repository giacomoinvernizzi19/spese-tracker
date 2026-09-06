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
  return rows.results;
}
