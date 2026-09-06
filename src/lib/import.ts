import { dateOnly, InputError, positiveAmount } from './validation';
export async function importDigest(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function importAmount(value: unknown): number {
  if (typeof value === 'number') return positiveAmount(value);
  if (typeof value !== 'string') throw new InputError('Importo mancante');
  const raw=value.trim().replace(/\s|€/g,'');
  let normalized=raw;
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw)) normalized=raw.replace(/\./g,'').replace(',','.');
  else if (/^\d+(,\d{1,2})?$/.test(raw)) normalized=raw.replace(',','.');
  else if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new InputError('Formato importo non valido');
  return positiveAmount(Number(normalized));
}
export function importDate(value: unknown): string {
  if (typeof value==='number') {
    if(!Number.isFinite(value) || value<1) throw new InputError('Data Excel non valida');
    const date=new Date((Math.floor(value)-25569)*86400000);
    if(!Number.isFinite(date.getTime())) throw new InputError('Data Excel non valida');
    return dateOnly(date.toISOString().slice(0,10));
  }
  if(typeof value!=='string') throw new InputError('Data mancante');
  const match=value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return dateOnly(match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:value.trim());
}
