import { dateOnly, ownedCategory, positiveAmount, transactionType } from './validation';

export interface Recurring {
  id: number; user_id: string; amount: number; type: 'expense' | 'income';
  description: string | null; category_id: number | null;
  frequency: 'monthly' | 'weekly' | 'yearly'; day_of_month: number | null;
  start_date: string; end_date: string | null; last_generated: string | null;
}
const lastDay = (year: number, month: number) => new Date(Date.UTC(year,month+1,0)).getUTCDate();
export function getDueDates(rec: Recurring, today: string): string[] {
  dateOnly(rec.start_date); dateOnly(today);
  if (rec.end_date) dateOnly(rec.end_date);
  const end = rec.end_date && rec.end_date < today ? rec.end_date : today;
  const start = new Date(`${rec.start_date}T00:00:00Z`);
  let cursor = new Date(`${rec.last_generated ?? rec.start_date}T00:00:00Z`);
  if (rec.last_generated) cursor.setUTCDate(cursor.getUTCDate()+1);
  if (cursor < start) cursor = new Date(start);
  const dates: string[] = [];
  while (cursor.toISOString().slice(0,10) <= end) {
    const year=cursor.getUTCFullYear(), month=cursor.getUTCMonth(), day=cursor.getUTCDate();
    const due = rec.frequency === 'weekly' ? cursor.getUTCDay() === (rec.day_of_month ?? 1)
      : rec.frequency === 'monthly' ? day === Math.min(rec.day_of_month ?? 1,lastDay(year,month))
      : month === start.getUTCMonth() && day === Math.min(start.getUTCDate(),lastDay(year,month));
    if (due) dates.push(cursor.toISOString().slice(0,10));
    cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  return dates;
}

export async function generatePendingTransactions(db: D1Database, userId?: string, today = new Date().toISOString().slice(0,10)): Promise<number> {
  const query = db.prepare('SELECT * FROM recurring_transactions WHERE active = 1' + (userId ? ' AND user_id = ?' : ''));
  const result = await (userId ? query.bind(userId) : query).all<Recurring>();
  let generated = 0;
  for (const rec of result.results) {
    positiveAmount(rec.amount); transactionType(rec.type); await ownedCategory(db,rec.user_id,rec.category_id);
    for (const date of getDueDates(rec,today)) {
      const results = await db.batch([
        db.prepare(`INSERT INTO transactions (user_id,amount,type,description,category_id,date,source,recurring_id,occurrence_date)
          VALUES (?,?,?,?,?,?,'recurring',?,?)
          ON CONFLICT(user_id,recurring_id,occurrence_date) WHERE recurring_id IS NOT NULL DO NOTHING`)
          .bind(rec.user_id,rec.amount,rec.type,rec.description ?? '',rec.category_id,date,rec.id,date),
        db.prepare('UPDATE recurring_transactions SET last_generated = MAX(COALESCE(last_generated, ?), ?) WHERE id = ? AND user_id = ?').bind(date,date,rec.id,rec.user_id),
      ]);
      generated += results[0].meta.changes;
    }
  }
  return generated;
}
