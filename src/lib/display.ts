import { escapeUTF8 } from 'entities/escape';

// Encode data at HTML insertion boundaries; never attempt to sanitize HTML.
export const displayText = (value: unknown): string => escapeUTF8(String(value ?? ''));
export const displayColor = (value: unknown): string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#6B7280';
export function displayImage(value: unknown): string {
  try { const url = new URL(String(value)); return url.protocol === 'https:' ? displayText(url.href) : ''; }
  catch { return ''; }
}
