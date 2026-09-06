import { authenticated,body,json } from '../../../lib/api';
import { bankConfig } from '../../../lib/bank';
import { encrypt } from '../../../lib/encryption';
import { InputError,text } from '../../../lib/validation';
export const prerender=false;
export const POST=authenticated(async({request,locals},db,user)=>{
  const {client,key,appUrl}=bankConfig(locals.runtime.env);
  const input=await body(request),institution=text(input.institution_id);
  const country=text(input.country || 'IT');
  if(!/^[A-Z]{2}$/.test(country))throw new InputError('Paese non valido');
  const banks=await client.getInstitutions(country);
  const bank=banks.find(item=>item.id===institution);
  if(!bank)throw new InputError('Banca non disponibile nel catalogo');
  const connectionId=crypto.randomUUID();
  const req=await client.createRequisition(institution,`${appUrl}/api/bank/callback`,connectionId);
  const link=new URL(req.link);
  if(link.protocol!=='https:' || !(link.hostname==='gocardless.com'||link.hostname.endsWith('.gocardless.com')))throw new InputError('Link bancario non valido',502);
  try {
    await db.prepare("INSERT INTO bank_connections(id,user_id,provider,institution_id,institution_name,requisition_id,status) VALUES(?,?,'nordigen',?,?,?,'pending')").bind(connectionId,user.id,institution,bank.name,await encrypt(req.id,key)).run();
  } catch(error) {
    try {await client.deleteRequisition(req.id);}catch{console.error('Unpersisted requisition cleanup failed');}
    throw error;
  }
  return json({link:req.link,connection_id:connectionId},201);
});
