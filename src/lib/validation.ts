export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Richiesta non valida');
  return value as Record<string, unknown>;
}
export function positiveAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new InputError('Importo non valido');
  return value;
}
export function positiveId(value: unknown): number {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw new InputError('Identificativo non valido');
  return id;
}
export function dateOnly(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError('Data non valida');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new InputError('Data non valida');
  return value;
}
export function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new InputError('Testo non valido');
  return value;
}
export function transactionType(value: unknown = 'expense'): 'income' | 'expense' {
  if (value !== 'income' && value !== 'expense') throw new InputError('Tipo transazione non valido');
  return value;
}
export async function ownedCategory(db: D1Database, userId: string, value: unknown): Promise<number | null> {
  if (value == null || value === '') return null;
  const id = positiveId(value);
  const category = await db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').bind(id,userId).first();
  if (!category) throw new InputError('Categoria non valida');
  return id;
}
