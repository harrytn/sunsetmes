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
  keypair: CryptoKeyPair | null;
  isReady: boolean;
  error: string | null;
  /** Force re-init (e.g. after importing a backup key) */
  reinit: () => void;
}

const CryptoContext = createContext<CryptoContextValue>({
  keypair: null,
  isReady: false,
  error: null,
  reinit: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CryptoProvider({ children }: { children: React.ReactNode }) {
  const [keypair, setKeypair] = useState<CryptoKeyPair | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // bumped to trigger re-init

  const init = useCallback(async () => {
    setIsReady(false);
    setError(null);
    try {
      // 1. Try IndexedDB first
      let kp = await getStoredKeypair();

      if (!kp) {
        // 2. Generate fresh keypair
        kp = await generateRsaKeypair();
        await storeKeypair(kp);

        // 3. Publish public key to server
        const pubJwk = await exportPublicKeyJwk(kp.publicKey);
        await fetch('/api/users/public-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pubJwk }),
        });
      } else {
        // Key exists locally — ensure the server also has the public key
        // (handles fresh DB wipes or profile changes)
        const pubJwk = await exportPublicKeyJwk(kp.publicKey);
        await fetch('/api/users/public-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: pubJwk }),
        });
      }

      setKeypair(kp);
      setIsReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Crypto init failed: ${msg}`);
      setIsReady(true); // unblock the UI even on error
    }
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void init();
  }, [init]);

  const reinit = useCallback(() => setRev((r) => r + 1), []);

  return (
    <CryptoContext.Provider value={{ keypair, isReady, error, reinit }}>
      {/* Subtle key-initialising overlay — only shown briefly on very first load */}
      {!isReady && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'rgba(138,163,194,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">🔐</div>
            <p
              className="font-serif text-base font-semibold"
              style={{ color: '#2B4162' }}
            >
              Preparing your secure keys…
            </p>
            <p
              className="font-sans text-xs mt-1"
              style={{ color: 'rgba(43,65,98,0.55)' }}
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
