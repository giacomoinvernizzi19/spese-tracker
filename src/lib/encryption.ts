// AES-GCM encryption utilities using Web Crypto API
// Used for encrypting sensitive bank data at rest

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
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

  return btoa(String.fromCharCode(...combined));
}

// Decrypt ciphertext
export async function decrypt(encryptedData: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

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

// Check if data is already encrypted (base64 encoded)
export function isEncrypted(data: string): boolean {
  try {
    // Encrypted data is base64 encoded and starts with the IV
    const decoded = atob(data);
    // Minimum length: 12 bytes IV + at least 16 bytes ciphertext (minimum for GCM)
    return decoded.length >= 28;
  } catch {
    return false;
  }
}

// Helper: encrypt if not already encrypted
export async function ensureEncrypted(data: string, keyHex: string): Promise<string> {
  if (isEncrypted(data)) {
    return data;
  }
  return encrypt(data, keyHex);
}

// Helper: decrypt if encrypted, otherwise return as-is
export async function safeDecrypt(data: string, keyHex: string): Promise<string> {
  if (!isEncrypted(data)) {
    return data;
  }
  try {
    return await decrypt(data, keyHex);
  } catch {
    // If decryption fails, return original data (might be plaintext)
    return data;
  }
}
