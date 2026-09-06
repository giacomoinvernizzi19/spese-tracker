// AES-GCM encryption utilities using Web Crypto API
// Used for encrypting sensitive bank data at rest

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw new Error("Invalid encryption key");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Import key from hex string
async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate a random encryption key (for initial setup)
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return bytesToHex(new Uint8Array(exported));
}

// Encrypt plaintext
export async function encrypt(plaintext: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return 'v1:' + btoa(String.fromCharCode(...combined));
}

// Decrypt ciphertext
export async function decrypt(encryptedData: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData.startsWith('v1:') ? encryptedData.slice(3) : encryptedData), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Only historical provider UUIDs and arrays of UUIDs are accepted as plaintext.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isLegacyPlaintext(data: string): boolean {
  if (uuid.test(data)) return true;
  try { const value: unknown = JSON.parse(data); return Array.isArray(value) && value.every(id=>typeof id==='string' && uuid.test(id)); }
  catch { return false; }
}
export async function safeDecrypt(data: string,keyHex: string): Promise<string> {
  if(isLegacyPlaintext(data)) return data;
  // A wrong key or corrupt ciphertext must never be sent to the provider as an ID.
  return decrypt(data,keyHex);
}
export async function ensureEncrypted(data: string,keyHex: string): Promise<string> {
  return encrypt(await safeDecrypt(data,keyHex),keyHex);
}
