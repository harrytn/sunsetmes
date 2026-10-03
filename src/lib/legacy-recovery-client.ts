/** Read existing keys only. New letters never use encryption or generate keys. */
type WrappedLetter = { id: string; encryptedKeySender: string | null; encryptedKeyRecipient: string | null };
export type RecoveryResult = {
  restored: number;
  remaining: number;
  savedKeys: number;
  matchedLetters: number;
  rejectedLetters: number;
  keySearchIssue: string | null;
};
type KeySearch = { keys: CryptoKey[]; issue: string | null };
const inProgress = new Map<string, Promise<RecoveryResult>>();

function bytes(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

async function savedPrivateKeys(): Promise<KeySearch> {
  if (typeof indexedDB === 'undefined') return { keys: [], issue: 'This browser does not allow access to saved keys.' };
  return new Promise<KeySearch>(resolve => {
    let db: IDBDatabase | undefined;
    let finished = false;
    const finish = (keys: CryptoKey[] = [], issue: string | null = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      db?.close();
      resolve({ keys, issue });
    };
    const timer = setTimeout(() => finish([], 'Checking saved keys timed out. Close other tabs for this website and check again.'), 8000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open('sm-keys'); }
    catch { finish([], 'This browser could not access its saved keys. Open the website in regular Safari and check again.'); return; }
    request.onupgradeneeded = () => { request.transaction?.abort(); finish(); };
    request.onerror = () => finish([], 'This browser could not read its saved keys. Open the website in regular Safari and check again.');
    request.onblocked = () => finish([], 'Another tab is blocking access to saved keys. Close other tabs for this website and check again.');
    request.onsuccess = () => {
      db = request.result;
      if (finished) { db.close(); return; }
      if (!db.objectStoreNames.contains('keypairs')) { finish(); return; }
      const transaction = db.transaction('keypairs', 'readonly');
      // Includes the original shared "main" key and every later profile key.
      const records = transaction.objectStore('keypairs').getAll();
      records.onsuccess = () => finish(records.result.flatMap((record: { privateKey?: CryptoKey } | null) =>
        record?.privateKey?.type === 'private' && record.privateKey.usages.includes('decrypt') ? [record.privateKey] : []));
      records.onerror = () => finish([], 'This browser could not read its saved keys.');
      transaction.onabort = () => finish([], 'Reading saved keys was interrupted. Check this browser again.');
    };
  }).catch(() => ({ keys: [], issue: 'This browser could not access its saved keys. Open the website in regular Safari and check again.' }));
}

async function recoveryRequest(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch {
    throw new Error(controller.signal.aborted
      ? 'The recovery request timed out. Check your connection and try again.'
      : 'Could not reach the app to restore your letters. Check your connection and try again.');
  }
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
  const found = await savedPrivateKeys();
  const privateKeys = [...extraKeys, ...found.keys];
  const cryptoAvailable = typeof crypto !== 'undefined' && !!crypto.subtle;
  const keySearchIssue = cryptoAvailable ? found.issue : 'This browser cannot unlock old letters. Open this website using HTTPS in Safari.';
  let after: string | null = null;
  let restored = 0;
  let remaining = 0;
  let matchedLetters = 0;
  let rejectedLetters = 0;
  do {
    const response = await recoveryRequest(`/api/letters/recover${after ? `?after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 401
      ? 'Your session has expired. Sign in to your profile again before restoring letters.'
      : `The app could not load older letters (server response ${response.status}). Please try again.`);
    const page = await response.json() as { letters: WrappedLetter[]; next: string | null };
    const recoveries: { id: string; aesKey: string }[] = [];
    for (const letter of page.letters) {
      const aesKey = cryptoAvailable ? await unwrapLegacyKey(letter, privateKeys) : null;
      if (aesKey) recoveries.push({ id: letter.id, aesKey });
    }
    let count = 0;
    matchedLetters += recoveries.length;
    if (recoveries.length) {
      const saved = await recoveryRequest('/api/letters/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recoveries }) });
      if (!saved.ok) throw new Error(saved.status === 401
        ? 'Your session has expired. Sign in to your profile again before restoring letters.'
        : `An old key was found, but saving the letters failed (server response ${saved.status}). Please try again.`);
      const result = await saved.json() as { restoredIds: string[] };
      count = result.restoredIds.length;
      rejectedLetters += recoveries.length - count;
    }
    restored += count;
    remaining += page.letters.length - count;
    after = page.next;
  } while (after);
  return { restored, remaining, savedKeys: privateKeys.length, matchedLetters, rejectedLetters, keySearchIssue };
}

export function recoverLegacyLetters(userId: string, extraKeys: CryptoKey[] = []): Promise<RecoveryResult> {
  if (extraKeys.length) return runRecovery(extraKeys);
  const existing = inProgress.get(userId);
  if (existing) return existing;
  const operation = runRecovery([]).finally(() => inProgress.delete(userId));
  inProgress.set(userId, operation);
  return operation;
}
