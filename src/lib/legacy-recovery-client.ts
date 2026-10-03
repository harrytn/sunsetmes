/** Read existing keys only. New letters never use encryption or generate keys. */
type WrappedLetter = { id: string; encryptedKeySender: string | null; encryptedKeyRecipient: string | null };
export type RecoveryResult = { restored: number; remaining: number };
const inProgress = new Map<string, Promise<RecoveryResult>>();

function bytes(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

async function savedPrivateKeys(): Promise<CryptoKey[]> {
  if (typeof indexedDB === 'undefined') return [];
  return new Promise<CryptoKey[]>(resolve => {
    let db: IDBDatabase | undefined;
    let finished = false;
    const finish = (keys: CryptoKey[] = []) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      db?.close();
      resolve(keys);
    };
    const timer = setTimeout(() => finish(), 4000);
    const request = indexedDB.open('sm-keys');
    request.onupgradeneeded = () => { request.transaction?.abort(); finish(); };
    request.onerror = () => finish();
    request.onblocked = () => finish();
    request.onsuccess = () => {
      db = request.result;
      if (finished) { db.close(); return; }
      if (!db.objectStoreNames.contains('keypairs')) { finish(); return; }
      const transaction = db.transaction('keypairs', 'readonly');
      // Includes the original shared "main" key and every later profile key.
      const records = transaction.objectStore('keypairs').getAll();
      records.onsuccess = () => finish(records.result.flatMap((record: { privateKey?: CryptoKey } | null) =>
        record?.privateKey?.type === 'private' && record.privateKey.usages.includes('decrypt') ? [record.privateKey] : []));
      records.onerror = () => finish();
      transaction.onabort = () => finish();
    };
  }).catch(() => []);
}

async function recoveryRequest(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function unwrapLegacyKey(letter: WrappedLetter, privateKeys: CryptoKey[]): Promise<string | null> {
  // Either participant's old key can recover the shared body, including on a shared device.
  for (const wrapped of new Set([letter.encryptedKeySender, letter.encryptedKeyRecipient])) {
    if (!wrapped) continue;
    for (const privateKey of privateKeys) {
      try {
        const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, bytes(wrapped)));
        if (raw.length === 32) return btoa(String.fromCharCode(...raw));
      } catch { /* Try other historical keys instead of blocking on a public-key mismatch. */ }
    }
  }
  return null;
}

export async function importLegacyBackup(backup: string, passphrase: string): Promise<CryptoKey> {
  const [salt, iv, ciphertext, ...extra] = backup.trim().split('.');
  if (!salt || !iv || !ciphertext || extra.length) throw new Error('Paste the complete saved backup.');
  try {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(salt), iterations: 100_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, key, bytes(ciphertext));
    const jwk = JSON.parse(new TextDecoder().decode(raw)) as JsonWebKey;
    return await crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  } catch { throw new Error('The backup or its passphrase does not match. Check the saved backup and try again.'); }
}

async function runRecovery(extraKeys: CryptoKey[]): Promise<RecoveryResult> {
  const privateKeys = [...extraKeys, ...await savedPrivateKeys()];
  let after: string | null = null;
  let restored = 0;
  let remaining = 0;
  do {
    const response = await recoveryRequest(`/api/letters/recover${after ? `?after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load your older letters. Please try again.');
    const page = await response.json() as { letters: WrappedLetter[]; next: string | null };
    const recoveries: { id: string; aesKey: string }[] = [];
    for (const letter of page.letters) {
      const aesKey = await unwrapLegacyKey(letter, privateKeys);
      if (aesKey) recoveries.push({ id: letter.id, aesKey });
    }
    let count = 0;
    if (recoveries.length) {
      const saved = await recoveryRequest('/api/letters/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recoveries }) });
      if (!saved.ok) throw new Error('Could not save the restored letters. Please try again.');
      const result = await saved.json() as { restoredIds: string[] };
      count = result.restoredIds.length;
    }
    restored += count;
    remaining += page.letters.length - count;
    after = page.next;
  } while (after);
  return { restored, remaining };
}

export function recoverLegacyLetters(userId: string, extraKeys: CryptoKey[] = []): Promise<RecoveryResult> {
  if (extraKeys.length) return runRecovery(extraKeys);
  const existing = inProgress.get(userId);
  if (existing) return existing;
  const operation = runRecovery([]).finally(() => inProgress.delete(userId));
  inProgress.set(userId, operation);
  return operation;
}
