export async function requestJson<T>(url:string,options?:RequestInit):Promise<T> {
  const response=await fetch(url,options);
  let data:unknown;
  try{data=await response.json();}catch{throw new Error('Risposta non leggibile dal server');}
  if(!response.ok)throw new Error(typeof data==='object' && data && 'error' in data?String(data.error):'Operazione non riuscita');
  return data as T;
}
export interface ListedTransaction {id:number;date:string;amount:number;description:string;type:string;category_name:string|null;}
export async function exportTransactions():Promise<ListedTransaction[]> {
  const items:ListedTransaction[]=[];
  let before='';
  while(true){
    const page=await requestJson<ListedTransaction[]>(`/api/transactions?limit=500&order=id${before?`&before_id=${before}`:''}`);
    if(!Array.isArray(page))throw new Error('Elenco transazioni non valido');
    items.push(...page);
    if(page.length<500)return items;
    const cursor=String(page.at(-1)!.id);
    if(cursor===before)throw new Error('Esportazione interrotta: paginazione non avanzata');
    before=cursor;
  }
}
