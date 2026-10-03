import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { decodeLegacyLetter } = await loadSource('../src/lib/legacy-letter.ts');
const { unwrapLegacyKey, importLegacyBackup, recoverLegacyLetters } = await loadSource('../src/lib/legacy-recovery-client.ts');
const rsa = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const [oldShared, recipient, different] = await Promise.all(Array.from({ length: 3 }, () => crypto.subtle.generateKey(rsa, true, ['encrypt', 'decrypt'])));
const base64 = data => Buffer.from(data).toString('base64');
const rawKey = crypto.getRandomValues(new Uint8Array(32));
const aes = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
const wrap = pair => crypto.subtle.encrypt('RSA-OAEP', pair.publicKey, rawKey).then(base64);
const wrapped = { id: 'old-letter', encryptedKeySender: await wrap(oldShared), encryptedKeyRecipient: await wrap(recipient) };
const content = 'An old letter 🌙\n\nKeep the exact spacing.  ';
const payload = JSON.stringify({ content, addressFrom: 'Sun\nLagos', addressTo: 'Moon', pigeonDestination: 'Aachen' });
const iv = crypto.getRandomValues(new Uint8Array(12));
const cipher = base64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(payload)));
const keyBase64 = base64(rawKey);
assert.equal(await unwrapLegacyKey(wrapped, [different.privateKey, oldShared.privateKey]), keyBase64);
assert.equal(await unwrapLegacyKey(wrapped, [recipient.privateKey]), keyBase64);
assert.equal(await unwrapLegacyKey(wrapped, [different.privateKey]), null);
assert.equal(await unwrapLegacyKey({ ...wrapped, encryptedKeySender: 'invalid' }, [recipient.privateKey]), keyBase64);
assert.deepEqual(decodeLegacyLetter(cipher, base64(iv), keyBase64), { content, addressFrom: 'Sun\nLagos', addressTo: 'Moon', pigeonDestination: 'Aachen' });
const rawCipher = base64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(content)));
assert.equal(decodeLegacyLetter(rawCipher, base64(iv), keyBase64).content, content);
assert.throws(() => decodeLegacyLetter(cipher, base64(iv), base64(new Uint8Array(32))));
const corrupt = Buffer.from(cipher, 'base64'); corrupt[0] ^= 1;
assert.throws(() => decodeLegacyLetter(base64(corrupt), base64(iv), keyBase64));

// Generate an authentic old backup using the previous PBKDF2/AES-GCM format.
const passphrase = 'saved-backup-passphrase';
const salt = crypto.getRandomValues(new Uint8Array(16));
const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
const backupKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', oldShared.privateKey));
const backupCipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, backupKey, new TextEncoder().encode(privateJwk));
const backup = `${base64(salt)}.${base64(iv)}.${base64(backupCipher)}`;
assert.equal(await unwrapLegacyKey(wrapped, [await importLegacyBackup(backup, passphrase)]), keyBase64);
await assert.rejects(importLegacyBackup(backup, 'incorrect'));

// Exercise automatic restoration with the oldest shared key plus an unrelated
// current profile key. Only the existing IDB store is read, never replaced.
let saved;
let dbClosed = false;
globalThis.indexedDB = {
  open(name) {
    assert.equal(name, 'sm-keys');
    const request = {};
    setTimeout(() => {
      request.result = {
        objectStoreNames: { contains: name => name === 'keypairs' },
        close() { dbClosed = true; },
        transaction(name, mode) {
          assert.equal(name, 'keypairs'); assert.equal(mode, 'readonly');
          return { objectStore() { return { getAll() {
            const records = {};
            setTimeout(() => { records.result = [{ id: 'main', privateKey: oldShared.privateKey }, { id: 'profile', privateKey: different.privateKey }]; records.onsuccess(); }, 0);
            return records;
          } }; } };
        },
      };
      request.onsuccess();
    }, 0);
    return request;
  },
};
globalThis.fetch = async (_url, options) => {
  if (options?.method === 'POST') {
    const { recoveries } = JSON.parse(options.body);
    assert.deepEqual(recoveries, [{ id: 'old-letter', aesKey: keyBase64 }]);
    saved = decodeLegacyLetter(cipher, base64(iv), recoveries[0].aesKey);
    return Response.json({ restoredIds: ['old-letter'] });
  }
  return Response.json({ letters: [wrapped], next: null });
};
assert.deepEqual(await recoverLegacyLetters('profile'), { restored: 1, remaining: 0, savedKeys: 2, matchedLetters: 1, rejectedLetters: 0, keySearchIssue: null });
assert.equal(saved.content, content); assert.equal(dbClosed, true);
// A missing database is different from an unreadable browser store.
globalThis.indexedDB = { open() {
  const request = { transaction: { abort() { setTimeout(() => request.onerror?.(), 0); } } };
  setTimeout(() => request.onupgradeneeded(), 0);
  return request;
} };
assert.deepEqual(await recoverLegacyLetters('empty-browser'), { restored: 0, remaining: 1, savedKeys: 0, matchedLetters: 0, rejectedLetters: 0, keySearchIssue: null });
globalThis.indexedDB = { open() { throw new Error('Browser storage unavailable'); } };
const storageFailure = await recoverLegacyLetters('blocked-browser');
assert.equal(storageFailure.savedKeys, 0);
assert.match(storageFailure.keySearchIssue, /could not access/);
delete globalThis.indexedDB;
const missingKeys = await recoverLegacyLetters('another-device');
assert.equal(missingKeys.restored, 0); assert.equal(missingKeys.remaining, 1); assert.equal(missingKeys.savedKeys, 0);
const restoredBackup = await recoverLegacyLetters('backup-device', [await importLegacyBackup(backup, passphrase)]);
assert.equal(restoredBackup.restored, 1); assert.equal(restoredBackup.remaining, 0); assert.equal(restoredBackup.matchedLetters, 1);
globalThis.fetch = async (_url, options) => options?.method === 'POST'
  ? Response.json({ restoredIds: [] }) : Response.json({ letters: [wrapped], next: null });
const rejected = await recoverLegacyLetters('rejected-body', [oldShared.privateKey]);
assert.equal(rejected.matchedLetters, 1); assert.equal(rejected.rejectedLetters, 1); assert.equal(rejected.restored, 0);
globalThis.fetch = async () => new Response(null, { status: 401 });
await assert.rejects(recoverLegacyLetters('expired-session'), /session has expired/);
globalThis.fetch = async () => new Response(null, { status: 500 });
await assert.rejects(recoverLegacyLetters('server-error'), /server response 500/);
console.log('Legacy recovery checks passed: shared and profile keys, both participants, original text and addresses, raw text, backup import, authenticated ciphertext, automatic persistence, and missing-key handling.');
