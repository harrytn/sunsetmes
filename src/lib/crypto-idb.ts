/**
 * src/lib/crypto-idb.ts
 *
 * IndexedDB persistence for the user's RSA keypair.
 * The private key is stored as a CryptoKey object (non-serialisable — native browser key).
 * We store both the public and private key so they can be retrieved atomically.
 *
 * DB: "sm-keys"  (Sunset Messages Keys)
 * Store: "keypairs"
 * Record: { id: "main", publicKey: CryptoKey, privateKey: CryptoKey }
 */

const DB_NAME = 'sm-keys';
const STORE_NAME = 'keypairs';
const LEGACY_KEY_ID = 'main';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (evt) => {
      const db = (evt.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface StoredKeypair {
  id: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function getStoredKeypair(userId: string): Promise<CryptoKeyPair | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(userId);
    req.onsuccess = () => {
      const record = req.result as StoredKeypair | undefined;
      if (!record) {
        const legacy = store.get(LEGACY_KEY_ID);
        legacy.onsuccess = () => {
          const old = legacy.result as StoredKeypair | undefined;
          resolve(old ? { publicKey: old.publicKey, privateKey: old.privateKey } : null);
        };
        legacy.onerror = () => reject(legacy.error);
        return;
      }
      if (!record) return resolve(null);
      resolve({
        publicKey: record.publicKey,
        privateKey: record.privateKey,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function storeKeypair(userId: string, keypair: CryptoKeyPair): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({
      id: userId,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

export async function clearStoredKeypair(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(userId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
