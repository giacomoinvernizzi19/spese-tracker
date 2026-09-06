import { authenticated } from '../../../lib/api';
import { bankConfig,refreshConsent,type BankConnection } from '../../../lib/bank';
import { InputError } from '../../../lib/validation';
export const prerender=false;
export const GET=authenticated(async({request,locals},db,user)=>{
  const {client,key,appUrl}=bankConfig(locals.runtime.env);
  const ref=new URL(request.url).searchParams.get('ref');
  const connection=await db.prepare('SELECT * FROM bank_connections WHERE id=? AND user_id=?').bind(ref,user.id).first<BankConnection>();
  if(!connection)throw new InputError('Collegamento non trovato',404);
  try {
    await refreshConsent(db,connection,client,key);
    return Response.redirect(`${appUrl}/banche/?status=success`,302);
  } catch {return Response.redirect(`${appUrl}/banche/?status=error&message=consent_unverified`,302);}
});
