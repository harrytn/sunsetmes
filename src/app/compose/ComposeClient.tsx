'use client';

/**
 * app/compose/ComposeClient.tsx
 *
 * Letter composition with client-side E2EE and coin-based delivery.
 * Selfie feature removed. Delivery costs shown on buttons.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import PigeonCalculator from '@/components/PigeonCalculator';
import { useCrypto } from '@/context/CryptoContext';
import { encryptLetter } from '@/lib/crypto-client';

type DeliveryType = 'STANDARD' | 'EXPRESS' | 'PIGEON';

interface Recipient {
  id: string;
  name: string;
  avatarColor: string;
}

interface PigeonData {
  distanceKm: number;
  flightDurationSec: number;
  survivalRate: number;
  senderLat: number;
  senderLng: number;
  destLat: number;
  destLng: number;
  destAddress: string;
  displayName: string;
}

interface Props {
  activeUserId: string;
  recipients: Recipient[];
  pigeonCoins: number;
}

const DELIVERY_OPTIONS: { type: DeliveryType; icon: string; label: string; desc: string; cost: number }[] = [
  { type: 'STANDARD', icon: '✉️', label: 'Standard',  desc: '14 days',            cost: 50 },
  { type: 'EXPRESS',  icon: '⚡', label: 'Express',   desc: '7 days',             cost: 100 },
  { type: 'PIGEON',   icon: '🐦', label: 'Pigeon',    desc: 'GPS-based flight',   cost: 150 },
];

export default function ComposeClient({ activeUserId, recipients, pigeonCoins }: Props) {
  const router = useRouter();
  const { keypair, isReady } = useCrypto();

  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('STANDARD');
  const [pigeonData, setPigeonData] = useState<PigeonData | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coins, setCoins] = useState(pigeonCoins);
  const [result, setResult] = useState<null | {
    survived?: boolean;
    pigeonNote?: string;
    cost?: number;
    flightDurationSec?: number;
    distanceKm?: number;
  }>(null);

  const currentCost = DELIVERY_OPTIONS.find((o) => o.type === deliveryType)?.cost ?? 50;
  const canAfford = coins >= currentCost;

  async function handleSend() {
    setError(null);

    if (!title.trim() || !content.trim()) {
      setError('Please write a title and a letter before sending.');
      return;
    }
    if (!canAfford) {
      setError(`Not enough PigeonCoins! You need ${currentCost} but have ${coins}.`);
      return;
    }
    if (deliveryType === 'PIGEON' && !pigeonData) {
      setError('Please calculate the pigeon route first.');
      return;
    }
    if (!keypair || !isReady) {
      setError('Encryption keys are not ready yet. Please wait a moment and try again.');
      return;
    }

    setSending(true);
    try {
      // Step 1: Fetch recipient's public key
      const pkRes = await fetch(`/api/users/public-key?userId=${recipientId}`);
      if (!pkRes.ok) {
        const { error: pkErr } = await pkRes.json();
        throw new Error(pkErr ?? "Could not fetch recipient's public key. They need to open the app first.");
      }
      const { publicKey: recipientPubJwk } = (await pkRes.json()) as { publicKey: string };

      // Step 2: Encrypt the letter client-side
      const encrypted = await encryptLetter(
        content.trim(),
        recipientPubJwk,
        keypair,
      );

      // Step 3: Build POST body
      const body: Record<string, unknown> = {
        recipientId,
        title: title.trim(),
        deliveryType,
        encryptedContent:      encrypted.encryptedContent,
        iv:                    encrypted.iv,
        encryptedKeyRecipient: encrypted.encryptedKeyRecipient,
        encryptedKeySender:    encrypted.encryptedKeySender,
      };

      if (deliveryType === 'PIGEON' && pigeonData) {
        body.senderLat   = pigeonData.senderLat;
        body.senderLng   = pigeonData.senderLng;
        body.destLat     = pigeonData.destLat;
        body.destLng     = pigeonData.destLng;
        body.destAddress = pigeonData.destAddress;
      }

      // Step 4: Send
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to send the letter.');
        setSending(false);
        return;
      }

      // Update local coin display
      setCoins((c) => c - (data.cost ?? currentCost));

      if (deliveryType === 'PIGEON') {
        setResult({
          survived:          data.survived,
          pigeonNote:        data.pigeonNote,
          cost:              data.cost,
          flightDurationSec: data.flightDurationSec,
          distanceKm:        data.distanceKm,
        });
        setSending(false);
        setTimeout(() => router.push('/'), 4000);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encryption or network error. Please try again.');
      setSending(false);
    }
  }

  // Pigeon outcome screen
  if (result) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <motion.div
          className="glass rounded-3xl p-8 text-center max-w-sm w-full"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        >
          <div className="text-6xl mb-4">{result.survived ? '🐦' : '💨'}</div>
          <h2 className="font-serif text-2xl font-bold mb-3" style={{ color: '#2B4162' }}>
            {result.survived ? 'Pigeon Dispatched!' : 'Pigeon in Trouble…'}
          </h2>
          {result.survived ? (
            <p className="font-sans text-sm mb-4" style={{ color: 'rgba(43,65,98,0.65)' }}>
              Your encrypted letter is airborne over{' '}
              <strong>{Math.round(result.distanceKm ?? 0).toLocaleString()} km</strong>.
            </p>
          ) : (
            <>
              <p className="font-sans text-sm mb-3 italic" style={{ color: 'rgba(43,65,98,0.65)' }}>
                {result.pigeonNote ?? 'Your pigeon may not survive the journey…'}
              </p>
              <p className="font-sans text-xs" style={{ color: 'rgba(43,65,98,0.5)' }}>
                If the pigeon fails, your letter will be returned and 75 coins refunded.
              </p>
            </>
          )}
          <p className="font-sans text-xs mt-4" style={{ color: 'rgba(43,65,98,0.35)' }}>
            Returning to inbox…
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-40 safe-top px-4 py-3 flex items-center gap-3"
        style={{
          background: 'rgba(138,163,194,0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(253,245,230,0.25)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(43,65,98,0.08)' }}
          aria-label="Go back"
        >
          <span style={{ color: '#2B4162', fontSize: 16 }}>←</span>
        </button>
        <h1 className="font-serif text-lg font-bold" style={{ color: '#2B4162' }}>
          Write a Letter
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Coin badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full glass">
            <span style={{ fontSize: 12 }}>🐦</span>
            <span className="font-sans text-xs font-bold" style={{ color: '#2B4162' }}>
              {coins}
            </span>
          </div>
          {/* E2EE badge */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: 'rgba(26,139,157,0.1)', border: '1px solid rgba(26,139,157,0.2)' }}
          >
            <span style={{ fontSize: 11 }}>🔐</span>
            <span className="font-sans text-[10px] font-semibold" style={{ color: '#1A8B9D' }}>E2EE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-32 flex flex-col gap-5">
        {/* To field */}
        {recipients.length > 1 && (
          <div>
            <label
              className="font-sans text-xs font-semibold tracking-wider uppercase mb-2 block"
              style={{ color: 'rgba(43,65,98,0.5)' }}
              htmlFor="recipient-select"
            >
              To
            </label>
            <select
              id="recipient-select"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl font-sans text-sm outline-none border"
              style={{ background: 'rgba(253,245,230,0.7)', color: '#2B4162', borderColor: 'rgba(26,139,157,0.25)' }}
            >
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label
            className="font-sans text-xs font-semibold tracking-wider uppercase mb-2 block"
            style={{ color: 'rgba(43,65,98,0.5)' }}
            htmlFor="letter-title"
          >
            Subject
          </label>
          <input
            id="letter-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this letter about?"
            className="w-full px-4 py-3 rounded-xl font-serif text-base outline-none border"
            style={{ background: 'rgba(253,245,230,0.7)', color: '#2B4162', borderColor: 'rgba(26,139,157,0.25)' }}
            maxLength={120}
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <label
            className="font-sans text-xs font-semibold tracking-wider uppercase mb-2 block"
            style={{ color: 'rgba(43,65,98,0.5)' }}
            htmlFor="letter-content"
          >
            Your Letter
          </label>
          <div
            className="rounded-2xl paper-texture overflow-hidden"
            style={{ background: '#FDF5E6', border: '1px solid rgba(26,139,157,0.2)', boxShadow: '0 4px 16px rgba(43,65,98,0.08)' }}
          >
            <textarea
              id="letter-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Dear Moon,&#10;&#10;I wanted to tell you…"
              className="w-full px-5 py-5 font-serif text-base leading-relaxed outline-none resize-none bg-transparent"
              style={{ color: '#2B4162', minHeight: 220 }}
              rows={9}
            />
          </div>
        </div>

        {/* Delivery type */}
        <div>
          <div className="font-sans text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: 'rgba(43,65,98,0.5)' }}>
            Delivery Method
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_OPTIONS.map(({ type, icon, label, desc, cost }) => {
              const affordable = coins >= cost;
              return (
                <motion.button
                  key={type}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl border transition-colors text-center"
                  style={{
                    background: deliveryType === type ? 'rgba(26,139,157,0.12)' : 'rgba(253,245,230,0.5)',
                    borderColor: deliveryType === type ? '#1A8B9D' : 'rgba(26,139,157,0.15)',
                    opacity: affordable ? 1 : 0.45,
                  }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeliveryType(type)}
                  aria-pressed={deliveryType === type}
                  disabled={!affordable}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="font-sans text-[11px] font-semibold leading-tight"
                    style={{ color: deliveryType === type ? '#1A8B9D' : '#2B4162' }}>
                    {label}
                  </span>
                  <span className="font-sans text-[10px] leading-tight" style={{ color: 'rgba(43,65,98,0.45)' }}>
                    {desc}
                  </span>
                  <span className="font-sans text-[10px] font-bold mt-0.5" style={{ color: affordable ? '#1A8B9D' : '#C0391B' }}>
                    🐦 {cost}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Pigeon sub-panel */}
        <AnimatePresence mode="wait">
          {deliveryType === 'PIGEON' && (
            <motion.div key="pigeon" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="glass rounded-2xl p-4">
              <h3 className="font-serif text-sm font-semibold mb-3" style={{ color: '#2B4162' }}>🐦 Pigeon Route</h3>
              <PigeonCalculator
                onResult={(r) => setPigeonData(r)}
                onClear={() => setPigeonData(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Crypto not ready */}
        {!isReady && (
          <div className="rounded-xl px-4 py-3 font-sans text-sm flex items-center gap-2"
            style={{ background: 'rgba(26,139,157,0.08)', color: '#1A8B9D' }}>
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
              🔐
            </motion.span>
            Generating encryption keys…
          </div>
        )}

        {/* Insufficient coins warning */}
        {!canAfford && (
          <div className="rounded-xl px-4 py-3 font-sans text-sm"
            style={{ background: 'rgba(255,81,47,0.08)', color: '#C0391B' }}>
            ⚠️ Not enough PigeonCoins. You need {currentCost} but have {coins}.
            Open the app daily for free coins!
          </div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            className="rounded-xl px-4 py-3 font-sans text-sm"
            style={{ background: 'rgba(255,81,47,0.1)', color: '#C0391B' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ⚠️ {error}
          </motion.div>
        )}
      </main>

      {/* Fixed send button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 safe-bottom z-50"
        style={{ background: 'linear-gradient(to top, rgba(138,163,194,0.6) 0%, transparent 100%)', backdropFilter: 'blur(8px)' }}
      >
        <motion.button
          className="w-full py-4 rounded-2xl font-sans text-base font-semibold text-white"
          style={{
            background: (sending || !isReady || !canAfford)
              ? 'rgba(43,65,98,0.25)'
              : 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)',
            boxShadow: (sending || !isReady || !canAfford) ? 'none' : '0 8px 24px rgba(255,81,47,0.35)',
          }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSend}
          disabled={sending || !isReady || !canAfford}
          id="send-letter-btn"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                🔐
              </motion.span>
              Encrypting & Sending…
            </span>
          ) : (
            `Send Letter  ·  🐦 ${currentCost}`
          )}
        </motion.button>
      </div>
    </div>
  );
}
