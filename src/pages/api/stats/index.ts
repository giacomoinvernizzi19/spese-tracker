import { authenticated,json } from '../../../lib/api';
import { periodFrom } from '../../../lib/period';
import { categoryTotals,monthNames } from '../../../lib/reporting';
export const prerender=false;
export const GET=authenticated(async({request},db,user)=>{
  const params=new URL(request.url).searchParams,period=periodFrom(params);
  const total=await db.prepare("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE user_id=? AND type='expense' AND date>=? AND date<=?").bind(user.id,period.from,period.to).first<{total:number}>();
  const categories=await categoryTotals(db,user.id,period,params.get('parentId'));
  const trend=await db.prepare("SELECT strftime('%m',date) month,strftime('%Y',date) year,SUM(amount) amount FROM transactions WHERE user_id=? AND type='expense' AND date>=? AND date<=? GROUP BY strftime('%Y-%m',date) ORDER BY year,month").bind(user.id,period.from,period.to).all<{month:string;year:string;amount:number}>();
  return json({totalMonth:total?.total ?? 0,byCategory:categories,monthlyTrend:trend.results.map(row=>({month:monthNames[Number(row.month)-1],year:row.year,amount:row.amount})),period});
});
