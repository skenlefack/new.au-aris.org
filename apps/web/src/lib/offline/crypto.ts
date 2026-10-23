/**
 * ARIS Offline Encryption — AES-GCM 256-bit via Web Crypto API.
 *
 * Protects sensitive data in IndexedDB (submissions, sync-queue payloads,
 * auth tokens) from being readable in plain text via DevTools.
 *
 * Architecture:
 *   - Key is derived from the user's password via PBKDF2 (100k iterations)
 *   - Salt is random per user, stored in IDB `meta` store (not secret)
 *   - AES-GCM provides both confidentiality AND integrity (authenticated)
 *   - Key lives in memory only — never persisted. Lost on page close.
 *   - If key is unavailable (page reload without re-auth), encrypted data
 *     is returned as-is (graceful degradation — sync will work after re-login)
 *
 * What gets encrypted:
 *   - submissions.data (form responses — potentially RESTRICTED/CONFIDENTIAL)
 *   - sync-queue.payload (mutations waiting to sync)
 *   - auth-tokens (access + refresh tokens)
 *
 * What stays in clear (performance + non-sensitive):
 *   - meta, dashboard-cache, campaigns, geo-entities, ref-data, form-templates
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12;   // 96 bits — recommended for AES-GCM
const SALT_META_KEY = 'crypto:salt';

/** Prefix to identify encrypted blobs vs plain data */
const ENCRYPTED_PREFIX = 'ARIS_ENC:';

/* ------------------------------------------------------------------ */
/*  In-memory key (singleton)                                          */
/* ------------------------------------------------------------------ */

let cryptoKey: CryptoKey | null = null;

/**
 * Check if encryption is available and initialized.
 */
export function isEncryptionReady(): boolean {
  return cryptoKey !== null;
}

/**
 * Check if Web Crypto API is available.
 */
export function hasCryptoSupport(): boolean {
  return typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof TextEncoder !== 'undefined';
}

/* ------------------------------------------------------------------ */
/*  Key derivation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Derive an AES-GCM 256-bit key from a password + salt using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Generate a random salt.
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/* ------------------------------------------------------------------ */
/*  Salt persistence (in IDB meta store)                               */
/* ------------------------------------------------------------------ */

/**
 * Get or create a salt for the current user.
 * Salt is stored in the `meta` IDB store.
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
  // Lazy import to avoid circular dependency with db.ts
  const { getDB } = await import('./db');
  const db = await getDB();

  const existing = await db.get('meta', SALT_META_KEY);
  if (existing && existing.ttlMs > 0) {
    // Salt stored as comma-separated bytes in the key field trick:
    // We use lastRefreshed as a flag and ttlMs to store length
    // Actually, let's use a cleaner approach — store salt as JSON in a dedicated entry
    try {
      const saltArray = JSON.parse(String(existing.lastRefreshed));
      if (Array.isArray(saltArray) && saltArray.length === SALT_LENGTH) {
        return new Uint8Array(saltArray);
      }
    } catch {
      // Corrupted — regenerate
    }
  }

  // Generate new salt
  const salt = generateSalt();
  await db.put('meta', {
    key: SALT_META_KEY,
    lastRefreshed: JSON.parse(JSON.stringify(Array.from(salt))) as unknown as number,
    ttlMs: SALT_LENGTH, // Use as flag that this is a salt entry
  });

  return salt;
}

/* ------------------------------------------------------------------ */
/*  Public API: init / destroy                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialize encryption with the user's password.
 * Call this at login time, before any IDB writes.
 * The derived key is kept in memory only.
 */
export async function initEncryption(password: string): Promise<boolean> {
  if (!hasCryptoSupport()) return false;

  try {
    const salt = await getOrCreateSalt();
    cryptoKey = await deriveKey(password, salt);
    return true;
  } catch (err) {
    console.warn('[ARIS Crypto] Failed to init encryption:', err);
    cryptoKey = null;
    return false;
  }
}

/**
 * Clear the encryption key from memory.
 * Call this on logout.
 */
export function destroyEncryption(): void {
  cryptoKey = null;
}

/* ------------------------------------------------------------------ */
/*  Public API: encrypt / decrypt                                      */
/* ------------------------------------------------------------------ */

/**
 * Encrypt a value for storage in IndexedDB.
 * Returns the encrypted string (prefixed with ARIS_ENC:).
 * If encryption is not available, returns the original value unchanged.
 */
export async function encryptValue(value: unknown): Promise<unknown> {
  if (!cryptoKey) return value;

  try {
    const plaintext = JSON.stringify(value);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data,
    );

    // Pack: iv + ciphertext → base64
    const packed = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), IV_LENGTH);

    return ENCRYPTED_PREFIX + uint8ToBase64(packed);
  } catch {
    // Encryption failed — return plain value (graceful degradation)
    return value;
  }
}

/**
 * Decrypt a value read from IndexedDB.
 * If the value is not encrypted (no prefix), returns it as-is.
 * If decryption fails (wrong key, corrupted), returns null.
 */
export async function decryptValue<T = unknown>(value: unknown): Promise<T | null> {
  // Not encrypted — return as-is
  if (typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value as T;
  }

  if (!cryptoKey) {
    // Key not available (page reloaded without login) — can't decrypt
    return null;
  }

  try {
    const packed = base64ToUint8(value.slice(ENCRYPTED_PREFIX.length));
    const iv = packed.slice(0, IV_LENGTH);
    const ciphertext = packed.slice(IV_LENGTH);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext,
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plainBuffer);
    return JSON.parse(plaintext) as T;
  } catch {
    // Decryption failed — wrong key or corrupted data
    return null;
  }
}

/**
 * Check if a value is encrypted.
 */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/* ------------------------------------------------------------------ */
/*  Base64 helpers (browser-safe, no atob/btoa for Uint8Array)         */
/* ------------------------------------------------------------------ */

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
