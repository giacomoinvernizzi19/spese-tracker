import { authenticated,body,json } from '../../../lib/api';
import { bankConfig,syncConnection,type BankConnection } from '../../../lib/bank';
import { dateOnly,InputError,text } from '../../../lib/validation';
export const prerender=false;
export const POST=authenticated(async({request,locals},db,user)=>{
  const {client,key}=bankConfig(locals.runtime.env),input=await body(request);
  const to=dateOnly(input.date_to ?? new Date().toISOString().slice(0,10));
  const from=input.date_from?dateOnly(input.date_from):undefined;
  if((from && from>to) || to>new Date().toISOString().slice(0,10))throw new InputError('Intervallo non valido');
  const id=input.connection_id?text(input.connection_id):null;
  const query=db.prepare("SELECT * FROM bank_connections WHERE user_id=? AND status='linked'"+(id?' AND id=?':''));
  const rows=await (id?query.bind(user.id,id):query.bind(user.id)).all<BankConnection>();
  if(id && !rows.results.length)throw new InputError('Conto non attivo',404);
  const accounts=[];
  for(const row of rows.results){
    try {accounts.push(...await syncConnection(db,row,client,key,from,to));}
    catch {accounts.push({account:row.id,fetched:0,staged:0,duplicates:0,excluded:0,error:'Consenso o configurazione non verificabile: ricollega il conto'});}
  }
  return json({from,to,new:0,staged:accounts.reduce((n,a)=>n+a.staged,0),fetched:accounts.reduce((n,a)=>n+a.fetched,0),duplicates:accounts.reduce((n,a)=>n+a.duplicates,0),excluded:accounts.reduce((n,a)=>n+a.excluded,0),errors:accounts.filter(a=>a.error).map(a=>a.error),accounts},accounts.some(a=>a.error)?207:200);
});
