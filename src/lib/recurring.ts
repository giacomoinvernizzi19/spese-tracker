// Generate pending transactions from recurring definitions

export async function generatePendingTransactions(db: D1Database, userId?: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  let generated = 0;

  // Get all active recurring transactions (optionally filtered by user)
  let query = `SELECT * FROM recurring_transactions WHERE active = 1`;
  const params: any[] = [];

  if (userId) {
    query += ` AND user_id = ?`;
    params.push(userId);
  }

  // Skip if end_date has passed
  query += ` AND (end_date IS NULL OR end_date >= ?)`;
  params.push(today);

  const recurring = await db.prepare(query).bind(...params).all();

  for (const rec of recurring.results as any[]) {
    const dates = getDueDates(rec, today);

    for (const date of dates) {
      await db.prepare(`
        INSERT INTO transactions (user_id, amount, type, description, category_id, date, source)
        VALUES (?, ?, ?, ?, ?, ?, 'recurring')
      `).bind(rec.user_id, rec.amount, rec.type, rec.description || '', rec.category_id, date).run();
      generated++;
    }

    if (dates.length > 0) {
      // Update last_generated to the latest generated date
      const lastDate = dates[dates.length - 1];
      await db.prepare(`UPDATE recurring_transactions SET last_generated = ? WHERE id = ?`)
        .bind(lastDate, rec.id).run();
    }
  }

  return generated;
}

function getDueDates(rec: any, todayStr: string): string[] {
  const dates: string[] = [];
  const today = new Date(todayStr);
  const startDate = new Date(rec.start_date);
  const lastGenerated = rec.last_generated ? new Date(rec.last_generated) : null;

  // Start from day after last_generated, or start_date if never generated
  let cursor = lastGenerated
    ? new Date(lastGenerated.getTime() + 86400000) // next day
    : new Date(startDate);

  while (cursor <= today) {
    if (isDue(rec, cursor)) {
      const dateStr = cursor.toISOString().split('T')[0];
      // Don't generate before start_date
      if (dateStr >= rec.start_date) {
        // Don't generate after end_date
        if (!rec.end_date || dateStr <= rec.end_date) {
          dates.push(dateStr);
        }
      }
    }
    cursor = new Date(cursor.getTime() + 86400000); // advance one day
  }

  return dates;
}

function isDue(rec: any, date: Date): boolean {
  switch (rec.frequency) {
    case 'monthly':
      return date.getDate() === (rec.day_of_month || 1);
    case 'weekly':
      // day_of_month used as day of week (0=Sunday)
      return date.getDay() === (rec.day_of_month || 1);
    case 'yearly': {
      const start = new Date(rec.start_date);
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    }
    default:
      return false;
  }
}
