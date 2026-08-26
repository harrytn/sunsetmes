'use client';

/**
 * app/letter/[id]/LetterClient.tsx
 *
 * Decrypts and renders a letter. Handles all statuses including RETURNED.
 * Selfie feature has been removed — all rendering is text-only.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Envelope3D from '@/components/Envelope3D';
import { useCrypto } from '@/context/CryptoContext';
import { decryptLetter, type EncryptedLetterPayload } from '@/lib/crypto-client';

interface LetterData {
  id: string;
  title: string;
  encryptedContent: string | null;
  iv: string | null;
  encryptedKeyRecipient: string | null;
  encryptedKeySender: string | null;
  paperStyle: string;
  waxSealColor: string;
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  deliverAt: string;
  openedAt: string | null;
  distanceKm: number | null;
  flightDurationSec: number | null;
  pigeonSurvived: boolean | null;
  pigeonNote: string | null;
  destAddress: string | null;
  sender:    { id: string; name: string; avatarColor: string };
  recipient: { id: string; name: string; avatarColor: string };
}

interface Props {
  letter: LetterData;
  activeUserId: string;
  locked: boolean;
  msUntilDelivery: number;
}

type DecryptState = 'idle' | 'decrypting' | 'done' | 'error';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function LetterClient({
  letter: initialLetter,
  activeUserId,
  locked: initialLocked,
  msUntilDelivery: initialMsUntilDelivery,
}: Props) {
  const router = useRouter();
  const { keypair, isReady } = useCrypto();
  const [currentLetter, setCurrentLetter] = useState<LetterData>(initialLetter);
  const [currentLocked, setCurrentLocked] = useState(initialLocked);
  const [currentMsUntilDelivery, setCurrentMsUntilDelivery] = useState(initialMsUntilDelivery);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const isSender = currentLetter.sender.id === activeUserId;
  const isRecipient = !isSender;

  const [decryptState, setDecryptState] = useState<DecryptState>('idle');
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptedAddressFrom, setDecryptedAddressFrom] = useState<string | undefined>(undefined);
  const [decryptedAddressTo, setDecryptedAddressTo] = useState<string | undefined>(undefined);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !keypair || currentLocked) return;

    const hasRecipientPayload =
      currentLetter.encryptedContent && currentLetter.iv && currentLetter.encryptedKeyRecipient;
    const hasSenderPayload =
      currentLetter.encryptedContent && currentLetter.iv && currentLetter.encryptedKeySender;

    const canDecrypt = isRecipient
      ? hasRecipientPayload
      : hasSenderPayload;

    if (!canDecrypt) return;

    async function decrypt() {
      setDecryptState('decrypting');
      try {
        const payload: EncryptedLetterPayload = {
          encryptedContent: currentLetter.encryptedContent!,
          iv: currentLetter.iv!,
          encryptedKeyRecipient: currentLetter.encryptedKeyRecipient ?? '',
          encryptedKeySender: currentLetter.encryptedKeySender ?? '',
        };

        const { content, addressFrom, addressTo } = await decryptLetter(
          payload,
          keypair!.privateKey,
          isRecipient,
        );

        setDecryptedContent(content);
        setDecryptedAddressFrom(addressFrom);
        setDecryptedAddressTo(addressTo);
        setDecryptState('done');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDecryptError(msg);
        setDecryptState('error');
      }
    }

    void decrypt();
  }, [isReady, keypair, currentLocked, isRecipient]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setResendError(null);

    try {
      const res = await fetch(`/api/letters/${currentLetter.id}/resend`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error ?? 'Failed to resend letter.');
        return;
      }

      setCurrentLetter((prev) => ({
        ...prev,
        ...data.letter,
      }));
      const ms = Math.max(0, new Date(data.letter.deliverAt).getTime() - Date.now());
      setCurrentMsUntilDelivery(ms);
    } catch {
      setResendError('Network error while resending.');
    } finally {
      setResending(false);
    }
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
        <motion.button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(43,65,98,0.08)', color: '#2B4162' }}
          whileTap={{ scale: 0.9 }}
          aria-label="Back to inbox"
        >
          ←
        </motion.button>
        <div>
          <p className="font-sans text-xs" style={{ color: 'rgba(43,65,98,0.5)' }}>
            {isSender
              ? `To ${currentLetter.recipient.name}`
              : `From ${currentLetter.sender.name}`}
          </p>
          <p className="font-sans text-xs font-medium" style={{ color: 'rgba(43,65,98,0.35)' }}>
            {formatDate(currentLetter.deliverAt)}
          </p>
        </div>

        {/* E2EE badge */}
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(26,139,157,0.1)', border: '1px solid rgba(26,139,157,0.2)' }}
        >
          <span style={{ fontSize: 11 }}>🔐</span>
          <span className="font-sans text-[10px] font-semibold" style={{ color: '#1A8B9D' }}>
            End-to-end encrypted
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pt-8 pb-16 flex flex-col items-center">

        {/* RETURNED banner with Resend button */}
        {currentLetter.status === 'RETURNED' && (
          <motion.div
            className="w-full max-w-sm mb-6 rounded-2xl px-5 py-4 text-center"
            style={{ background: 'rgba(255,81,47,0.08)', border: '1px solid rgba(255,81,47,0.2)' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-3xl mb-2">🐦💨</div>
            <h2 className="font-serif text-base font-semibold mb-1" style={{ color: '#C0391B' }}>
              Letter Returned
            </h2>
            <p className="font-sans text-sm mb-2" style={{ color: 'rgba(43,65,98,0.65)' }}>
              Your pigeon couldn&apos;t complete the journey. 75 coins were refunded.
            </p>
            {currentLetter.pigeonNote && (
              <p className="font-sans text-xs italic mb-3" style={{ color: 'rgba(43,65,98,0.5)' }}>
                {currentLetter.pigeonNote}
              </p>
            )}

            {isSender && (
              <motion.button
                onClick={handleResend}
                disabled={resending}
                className="px-4 py-2 rounded-full font-sans text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)',
                  boxShadow: '0 4px 14px rgba(255,81,47,0.35)',
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
              >
                {resending ? (
                  <>
                    <motion.span
                      className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    <span>Dispatching Pigeon…</span>
                  </>
                ) : (
                  <span>🐦 Resend Letter (150 🪙)</span>
                )}
              </motion.button>
            )}

            {resendError && (
              <p className="font-sans text-xs text-red-600 mt-2 font-medium">
                {resendError}
              </p>
            )}
          </motion.div>
        )}

        {/* Pigeon flight info */}
        {currentLetter.deliveryType === 'PIGEON' &&
          currentLetter.status === 'IN_FLIGHT' &&
          currentLetter.distanceKm != null && (
            <motion.div
              className="w-full max-w-sm mb-4 glass rounded-2xl px-4 py-3 flex items-center gap-3"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-2xl">🐦</span>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-xs font-semibold" style={{ color: '#1A8B9D' }}>
                  Pigeon in flight
                </p>
                <p className="font-sans text-xs truncate" style={{ color: 'rgba(43,65,98,0.55)' }}>
                  {Math.round(currentLetter.distanceKm).toLocaleString()} km → {currentLetter.destAddress}
                </p>
              </div>
            </motion.div>
          )}

        {/* Decryption error */}
        {decryptState === 'error' && (
          <motion.div
            className="w-full max-w-sm mb-4 rounded-2xl px-4 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ background: 'rgba(255,81,47,0.1)', border: '1px solid rgba(255,81,47,0.2)' }}
          >
            <p className="font-sans text-xs font-semibold mb-1" style={{ color: '#C0391B' }}>
              ⚠️ Decryption failed
            </p>
            <p className="font-sans text-xs" style={{ color: 'rgba(43,65,98,0.65)' }}>
              {decryptError}
            </p>
            <p className="font-sans text-xs mt-1" style={{ color: 'rgba(43,65,98,0.45)' }}>
              Use &quot;Back up key&quot; in settings to transfer your keys between devices.
            </p>
          </motion.div>
        )}

        {/* 3D Envelope */}
        <div className="w-full max-w-sm">
          <Envelope3D
            status={currentLetter.status}
            locked={currentLocked}
            senderName={currentLetter.sender.name}
            recipientName={currentLetter.recipient.name}
            addressFrom={decryptedAddressFrom}
            addressTo={decryptedAddressTo}
            title={currentLetter.title}
            waxSealColor={currentLetter.waxSealColor}
            deliveryType={currentLetter.deliveryType}
            msUntilDelivery={currentMsUntilDelivery}
          >
            {/* Decrypting spinner */}
            {decryptState === 'decrypting' && (
              <div className="flex items-center justify-center py-8 gap-3">
                <motion.div
                  className="w-5 h-5 rounded-full border-2"
                  style={{ borderColor: '#1A8B9D', borderTopColor: 'transparent' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <p className="font-sans text-sm" style={{ color: 'rgba(43,65,98,0.55)' }}>
                  Decrypting…
                </p>
              </div>
            )}

            {/* Decrypted letter content */}
            {decryptState === 'done' && decryptedContent && (
              <motion.div
                className="whitespace-pre-wrap break-words"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {decryptedContent}
              </motion.div>
            )}
          </Envelope3D>
        </div>

        {/* Sender note */}
        {isSender && (
          <motion.p
            className="mt-6 font-sans text-xs text-center max-w-xs"
            style={{ color: 'rgba(43,65,98,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            You sent this letter on {formatDate(currentLetter.deliverAt)}
            {currentLetter.status === 'IN_FLIGHT'
              ? " — it hasn't arrived yet."
              : currentLetter.status === 'RETURNED'
                ? ' — the pigeon returned it.'
                : '.'}
          </motion.p>
        )}
      </main>
    </div>
  );
}
