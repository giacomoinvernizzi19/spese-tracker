import { authenticated,json } from '../../../lib/api';
import { createNordigenClient } from '../../../lib/nordigen';
import { InputError } from '../../../lib/validation';
export const prerender=false;
export const GET=authenticated(async({request,locals})=>{
  const country=new URL(request.url).searchParams.get('country') ?? 'IT';
  if(!/^[A-Z]{2}$/.test(country))throw new InputError('Paese non valido');
  const institutions=await createNordigenClient(locals.runtime.env).getInstitutions(country);
  if(!Array.isArray(institutions))throw new InputError('Catalogo bancario non disponibile',502);
  return json(institutions.map(({id,name,logo,bic})=>({id,name,logo,bic})));
});
