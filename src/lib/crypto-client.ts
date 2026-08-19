/**
 * src/lib/crypto-client.ts
 *
 * All E2EE cryptographic operations using the native browser Web Crypto API.
 * NEVER imported by server-side code — this is browser-only.
 *
 * Scheme:
 *   Asymmetric  RSA-OAEP 2048-bit / SHA-256   (key wrapping)
 *   Symmetric   AES-GCM 256-bit               (content encryption)
 */

// ─── Algorithm constants ──────────────────────────────────────────────────────

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const AES_PARAMS = { name: 'AES-GCM', length: 256 } as const;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer as ArrayBuffer;
}

// ─── RSA Keypair ──────────────────────────────────────────────────────────────

/**
 * Generate an RSA-OAEP keypair.
 * Both keys are extractable so the private key can be backed up.
 */
export async function generateRsaKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, /* extractable */ true, [
    'encrypt',
    'decrypt',
  ]);
}

/** Export public key as a compact JWK JSON string for DB storage. */
export async function exportPublicKeyJwk(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

/** Export private key as a JWK JSON string (for backup only). */
export async function exportPrivateKeyJwk(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

/** Import a public key from a JWK JSON string. */
export async function importPublicKeyJwk(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, RSA_PARAMS, false, ['encrypt']);
}

/** Import a private key from a JWK JSON string. */
export async function importPrivateKeyJwk(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, RSA_PARAMS, true, ['decrypt']);
}

// ─── AES-GCM ─────────────────────────────────────────────────────────────────

/** Generate a fresh ephemeral AES-GCM-256 key. */
export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_PARAMS, /* extractable */ true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt a UTF-8 string with AES-GCM.
 * Returns { ciphertext, iv } both as base64 strings.
 */
export async function aesEncrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  return {
    ciphertext: bufferToBase64(cipherBuf),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt an AES-GCM ciphertext back to a UTF-8 string.
 */
export async function aesDecrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const ivBuf = base64ToBuffer(iv);
  const cipherBuf = base64ToBuffer(ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    cipherBuf,
  );
  return new TextDecoder().decode(plainBuf);
}

// ─── Key wrapping ─────────────────────────────────────────────────────────────

/**
 * Wrap (encrypt) an AES key with an RSA-OAEP public key.
 * Returns the wrapped key as a base64 string.
 */
export async function wrapAesKey(
  aesKey: CryptoKey,
  rsaPublicKey: CryptoKey,
): Promise<string> {
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    rawAes,
  );
  return bufferToBase64(wrapped);
}

/**
 * Unwrap (decrypt) an RSA-OAEP-wrapped AES key using the private key.
 * Returns the recovered AES-GCM CryptoKey.
 */
export async function unwrapAesKey(
  wrappedB64: string,
  rsaPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = base64ToBuffer(wrappedB64);
  const rawAes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    wrapped,
  );
  return crypto.subtle.importKey('raw', rawAes, AES_PARAMS, false, [
    'encrypt',
    'decrypt',
  ]);
}

// ─── High-level letter helpers ────────────────────────────────────────────────

export interface EncryptedLetterPayload {
  encryptedContent: string;
  iv: string;
  encryptedKeyRecipient: string;
  encryptedKeySender: string;
}

/**
 * Encrypt a letter's content for a given recipient.
 *
 * @param content          Plaintext letter body
 * @param recipientPubJwk  JWK string of the recipient's RSA public key
 * @param senderKeypair    The sender's CryptoKeyPair (from IDB)
 */
export async function encryptLetter(
  content: string,
  recipientPubJwk: string,
  senderKeypair: CryptoKeyPair,
): Promise<EncryptedLetterPayload> {
  // 1. Generate ephemeral AES-GCM key
  const aesKey = await generateAesKey();

  // 2. Encrypt content
  const { ciphertext: encryptedContent, iv } = await aesEncrypt(aesKey, content);

  // 3. Import recipient public key and wrap AES key for them
  const recipientPubKey = await importPublicKeyJwk(recipientPubJwk);
  const encryptedKeyRecipient = await wrapAesKey(aesKey, recipientPubKey);

  // 4. Wrap AES key for sender (so they can also read their own letter)
  const encryptedKeySender = await wrapAesKey(aesKey, senderKeypair.publicKey);

  return {
    encryptedContent,
    iv,
    encryptedKeyRecipient,
    encryptedKeySender,
  };
}

/**
 * Decrypt a letter's content.
 *
 * @param payload      The encrypted fields from the database
 * @param privateKey   The current user's RSA private key (from IDB)
 * @param isRecipient  true → use encryptedKeyRecipient; false → use encryptedKeySender
 */
export async function decryptLetter(
  payload: EncryptedLetterPayload,
  privateKey: CryptoKey,
  isRecipient: boolean,
): Promise<{ content: string }> {
  // 1. Choose the wrapped key for this user's role
  const wrappedKey = isRecipient
    ? payload.encryptedKeyRecipient
    : payload.encryptedKeySender;

  // 2. Unwrap the AES key
  const aesKey = await unwrapAesKey(wrappedKey, privateKey);

  // 3. Decrypt content
  const content = await aesDecrypt(aesKey, payload.encryptedContent, payload.iv);

  return { content };
}

// ─── Passphrase-derived key backup ───────────────────────────────────────────

/**
 * Derive a wrapping AES key from a user passphrase using PBKDF2.
 * Returns { derivedKey, salt } — salt must be stored alongside the backup blob.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Uint8Array<ArrayBuffer>,
): Promise<{ derivedKey: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const resolvedSalt =
    salt ?? (crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: resolvedSalt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return { derivedKey, salt: resolvedSalt };
}

/**
 * Export and encrypt the private key with a passphrase.
 * Returns a single base64 string: "<saltB64>.<ivB64>.<ciphertextB64>"
 */
export async function exportKeyWithPassphrase(
  privateKey: CryptoKey,
  passphrase: string,
): Promise<string> {
  const { derivedKey, salt } = await deriveKeyFromPassphrase(passphrase);
  const jwkStr = await exportPrivateKeyJwk(privateKey);
  const { ciphertext, iv } = await aesEncrypt(derivedKey, jwkStr);
  const saltB64 = bufferToBase64(salt.buffer as ArrayBuffer);
  return `${saltB64}.${iv}.${ciphertext}`;
}

/**
 * Decrypt and import a passphrase-protected private key backup.
 * Inverse of exportKeyWithPassphrase.
 */
export async function importKeyWithPassphrase(
  blob: string,
  passphrase: string,
): Promise<CryptoKey> {
  const parts = blob.split('.');
  if (parts.length < 3) throw new Error('Invalid backup blob format.');
  const saltB64 = parts[0];
  const iv = parts[1];
  const ciphertext = parts.slice(2).join('.'); // ciphertext itself won't contain '.' but safe
  const salt = new Uint8Array(base64ToBuffer(saltB64)) as Uint8Array<ArrayBuffer>;
  const { derivedKey } = await deriveKeyFromPassphrase(passphrase, salt);
  const jwkStr = await aesDecrypt(derivedKey, ciphertext, iv);
  return importPrivateKeyJwk(jwkStr);
}
