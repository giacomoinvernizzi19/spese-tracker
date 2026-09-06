import { dateOnly,InputError } from './validation';
export interface Period {from:string;to:string;year:number;month:number;}
export function calendarYear(value:string|null,now=new Date()):number {
  const year=value===null?now.getUTCFullYear():Number(value);
  if(!Number.isInteger(year)||year<1000||year>9999)throw new InputError('Anno non valido');return year;
}
export function periodFrom(params:URLSearchParams,annual=false,now=new Date()):Period {
  const year=calendarYear(params.get('year'),now);
  const month=params.has('month')?Number(params.get('month')):now.getUTCMonth()+1;
  if(!Number.isInteger(month)||month<1||month>12)throw new InputError('Mese non valido');
  const start=params.get('from'),end=params.get('to');
  if(!!start!==!!end)throw new InputError('Specificare inizio e fine periodo');
  const from=start?dateOnly(start):`${year}-${annual?'01':String(month).padStart(2,'0')}-01`;
  const to=end?dateOnly(end):annual?`${year}-12-31`:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  if(from>to)throw new InputError('Intervallo non valido');
  return {from,to,year,month};
}
