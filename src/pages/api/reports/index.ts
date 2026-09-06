import { authenticated,json } from '../../../lib/api';
import { periodFrom } from '../../../lib/period';
import { categoryTotals } from '../../../lib/reporting';
export const prerender=false;
export const GET=authenticated(async({request},db,user)=>{
  const params=new URL(request.url).searchParams,period=periodFrom(params,true);
  const year=String(period.year),parentId=params.get('parentId');
    // Spese per mese dell'anno selezionato
    const monthlyData = await db.prepare(`
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).bind(user.id, period.from, period.to).all();

    const categoryData={results:await categoryTotals(db,user.id,period,parentId)};

    // Confronto anno precedente
    const prevYear = (parseInt(year) - 1).toString();
    const yearComparison = await db.prepare(`
      SELECT
        strftime('%Y', date) as year,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income
      FROM transactions
      WHERE user_id = ? AND strftime('%Y', date) IN (?, ?)
      GROUP BY strftime('%Y', date)
    `).bind(user.id, year, prevYear).all();

    // Top 10 spese più alte dell'anno
    // Include parent category per mostrare "Viaggio > Voli" quando la transazione
    // è associata a una sottocategoria
    const topExpenses = await db.prepare(`
      SELECT
        t.amount,
        t.description,
        t.date,
        c.name as category_name,
        c.icon as category_icon,
        parent.name as parent_name,
        parent.icon as parent_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories parent ON c.parent_id = parent.id
      WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
        AND t.type = 'expense'
      ORDER BY t.amount DESC
      LIMIT 10
    `).bind(user.id, period.from, period.to).all();

    // Media spese giornaliere per mese - query semplificata
    // Calcola: totale spese del mese / giorni con spese nel mese
    const dailyAverage = await db.prepare(`
      SELECT
        strftime('%m', date) as month,
        CAST(SUM(amount) AS REAL) / COUNT(DISTINCT date) as avg_daily
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ? AND type = 'expense'
      GROUP BY strftime('%m', date)
      ORDER BY month
    `).bind(user.id, period.from, period.to).all();

    // Anni disponibili per il filtro
    const availableYears = await db.prepare(`
      SELECT DISTINCT strftime('%Y', date) as year
      FROM transactions
      WHERE user_id = ?
      ORDER BY year DESC
    `).bind(user.id).all();

    // Formatta i mesi
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    const formattedMonthly = monthlyData.results.map((m: any) => ({
      month: monthNames[parseInt(m.month) - 1],
      monthNum: m.month,
      expenses: m.expenses || 0,
      income: m.income || 0
    }));

    const formattedDailyAvg = dailyAverage.results.map((m: any) => ({
      month: monthNames[parseInt(m.month) - 1],
      avgDaily: Math.round(m.avg_daily * 100) / 100
    }));

    return json({
      year,
      monthly: formattedMonthly,
      categories: categoryData.results,
      yearComparison: yearComparison.results,
      topExpenses: topExpenses.results,
      dailyAverage: formattedDailyAvg,
      availableYears: availableYears.results.map((y: any) => y.year)
    });
});
