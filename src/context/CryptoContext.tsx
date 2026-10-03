'use client';

/**
 * src/context/CryptoContext.tsx
 *
 * React context that initialises and provides the user's RSA keypair.
 *
 * On mount:
 *   1. Reads keypair from IndexedDB.
 *   2. If absent: generates new RSA-OAEP keypair, stores in IDB, and POSTs the
 *      public key to /api/users/public-key (so the other user can encrypt for us).
 *   3. Makes { keypair, isReady, error } available via useCrypto().
 *
 * IMPORTANT: This context only runs in the browser (client component).
 * Server components must never import from this file.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  generateRsaKeypair,
  exportPublicKeyJwk,
} from '@/lib/crypto-client';
import {
  getStoredKeypair,
  storeKeypair,
} from '@/lib/crypto-idb';

// ─── Context shape ────────────────────────────────────────────────────────────

interface CryptoContextValue {
  userId: string | null;
  keypair: CryptoKeyPair | null;
  isReady: boolean;
  error: string | null;
  /** Force re-init (e.g. after importing a backup key) */
  reinit: () => void;
}

const CryptoContext = createContext<CryptoContextValue>({
  userId: null,
  keypair: null,
  isReady: false,
  error: null,
  reinit: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CryptoProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const [keypair, setKeypair] = useState<CryptoKeyPair | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // bumped to trigger re-init

  const init = useCallback(async () => {
    setIsReady(false);
    setError(null);
    setKeypair(null);
    if (!userId) { setIsReady(true); return; }
    try {
      const keyResponse = await fetch('/api/users/public-key');
      if (!keyResponse.ok && keyResponse.status !== 404) throw new Error('Could not check your public key.');
      const published = keyResponse.ok ? (await keyResponse.json()).publicKey as string : null;
      let kp = await getStoredKeypair(userId);
      if (!kp && published) throw new Error('This profile already has an encryption key. Import its backup on this device before writing letters.');
      if (!kp) kp = await generateRsaKeypair();
      const pubJwk = await exportPublicKeyJwk(kp.publicKey);
      if (published) {
        const local = JSON.parse(pubJwk) as JsonWebKey;
        const remote = JSON.parse(published) as JsonWebKey;
        if (local.n !== remote.n || local.e !== remote.e) throw new Error('This device has a different key for this profile. Import the correct backup.');
      } else {
        const saveResponse = await fetch('/api/users/public-key', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pubJwk }),
        });
        if (!saveResponse.ok) throw new Error('Could not publish your encryption key.');
      }
      await storeKeypair(userId, kp);

      setKeypair(kp);
      setIsReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Crypto init failed: ${msg}`);
      setIsReady(true); // unblock the UI even on error
    }
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void init(), 0);
    return () => window.clearTimeout(timer);
  }, [init, rev]);

  const reinit = useCallback(() => setRev((r) => r + 1), []);

  return (
    <CryptoContext.Provider value={{ userId, keypair, isReady, error, reinit }}>
      {/* Brief key initialization state. */}
      {!isReady && userId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: '#FFF8ED',
          }}
        >
          <div className="text-center">
            <p className="eyebrow">Private correspondence</p>
            <p
              className="font-serif text-base font-semibold"
              style={{ color: '#261F19' }}
            >
              Preparing your secure keys…
            </p>
            <p
              className="font-sans text-xs mt-1"
              style={{ color: '#665548' }}
            >
              This only happens once
            </p>
          </div>
        </div>
      )}
      {children}
    </CryptoContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCrypto(): CryptoContextValue {
  return useContext(CryptoContext);
}
