'use client';

/**
 * app/InboxClient.tsx
 *
 * Client-side inbox & outbox view with:
 * - Tab switching between Inbox (received) and Outbox (sent)
 * - Daily check-in (auto-calls /api/economy/check-in on mount)
 * - Daily Question Widget & Past Question Archive
 * - Realistic Envelope Cards with stamps & sender/recipient badges
 * - Resend action for RETURNED pigeon letters in Outbox
 * - User switcher, key backup, notification prompt
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import UserSwitcher from '@/components/UserSwitcher';
import NotificationPrompt from '@/components/NotificationPrompt';
import KeyBackup from '@/components/KeyBackup';
import DailyQuestionWidget from '@/components/DailyQuestionWidget';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfileInfo {
  id: string;
  name: string;
  avatarColor: string;
}

interface LetterSummary {
  id: string;
  senderId: string;
  recipientId: string;
  title: string;
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
  createdAt: string;
  sender: UserProfileInfo;
  recipient: UserProfileInfo;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  pigeonCoins: number;
}

interface Props {
  activeUser: UserInfo;
  allUsers: UserInfo[];
  letters: LetterSummary[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function msUntilDelivery(deliverAt: string): number {
  return Math.max(0, new Date(deliverAt).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Arrived';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function deliveryIcon(type: LetterSummary['deliveryType']) {
  if (type === 'EXPRESS') return '⚡';
  if (type === 'PIGEON') return '🐦';
  return '✉️';
}

// ─── Mini Postage Stamp for Cards ────────────────────────────────────────────

function MiniStamp({ senderName }: { senderName: string }) {
  const isSun = senderName.toLowerCase().includes('sun') || !senderName.toLowerCase().includes('moon');

  return (
    <div
      className="w-9 h-11 rounded-[2px] p-0.5 shadow-sm flex flex-col justify-between items-center relative overflow-hidden"
      style={{
        background: isSun
          ? 'linear-gradient(135deg, #FF6B4A 0%, #FFA834 100%)'
          : 'linear-gradient(135deg, #2B4162 0%, #5E7EA8 100%)',
        border: '1.5px dashed rgba(253, 245, 230, 0.85)',
      }}
    >
      <div className="w-full flex justify-between text-[5px] font-sans font-bold text-[#FDF5E6]/90 px-0.5 leading-none">
        <span>{isSun ? 'SUN' : 'MOON'}</span>
        <span>50¢</span>
      </div>
      <span className="text-[11px] leading-none my-auto">
        {isSun ? '☀️' : '🌙'}
      </span>
      <div className="w-full text-center text-[4.5px] font-sans font-bold text-[#FDF5E6]/80 border-t border-[#FDF5E6]/30 leading-tight">
        AIR
      </div>
    </div>
  );
}

// ─── Envelope Card ────────────────────────────────────────────────────────────

function EnvelopeCard({
  letter,
  index,
  isOutbox,
  onResend,
  isResending,
}: {
  letter: LetterSummary;
  index: number;
  isOutbox?: boolean;
  onResend?: (letterId: string) => void;
  isResending?: boolean;
}) {
  const ms = msUntilDelivery(letter.deliverAt);
  const isLocked = ms > 0 && letter.status === 'IN_FLIGHT';
  const isLost = letter.status === 'LOST';
  const isReturned = letter.status === 'RETURNED';
  const isOpened = !!letter.openedAt;

  const partnerInfo = isOutbox ? letter.recipient : letter.sender;
  const partnerLabel = isOutbox ? 'To' : 'From';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 220, damping: 22 }}
    >
      <Link href={`/letter/${letter.id}`} className="block">
        <motion.div
          className="relative rounded-2xl overflow-hidden cursor-pointer paper-texture"
          style={{
            background: isReturned
              ? 'linear-gradient(145deg, #FDF5E6 0%, #F5E0D0 100%)'
              : 'linear-gradient(145deg, #FDF5E6 0%, #F5EDD8 100%)',
            boxShadow: isOpened
              ? '0 4px 16px rgba(43,65,98,0.08)'
              : '0 8px 28px rgba(43,65,98,0.14), 0 2px 6px rgba(43,65,98,0.08)',
            border: '1px solid rgba(26,139,157,0.18)',
          }}
          whileHover={{ y: -3, boxShadow: '0 14px 40px rgba(43,65,98,0.18)' }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Envelope flap */}
          <div className="h-9 relative overflow-hidden">
            <svg viewBox="0 0 340 36" className="w-full h-full" preserveAspectRatio="none">
              <polygon
                points="0,0 340,0 170,32"
                fill={`${letter.waxSealColor}18`}
                stroke={`${letter.waxSealColor}40`}
                strokeWidth="0.5"
              />
            </svg>
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
              style={{
                background: letter.waxSealColor,
                boxShadow: `0 2px 8px ${letter.waxSealColor}66`,
              }}
            >
              🌅
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pb-3.5 pt-1">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                  style={{ background: partnerInfo.avatarColor }}
                >
                  {partnerInfo.name[0]}
                </div>
                <div>
                  <span className="font-sans text-[10px] font-medium text-gray-500 mr-1">
                    {partnerLabel}
                  </span>
                  <span className="font-sans text-xs font-semibold" style={{ color: '#2B4162' }}>
                    {partnerInfo.name}
                  </span>
                </div>
              </div>

              {/* Mini postage stamp & delivery type icon */}
              <div className="flex items-center gap-2">
                <span className="text-sm">{deliveryIcon(letter.deliveryType)}</span>
                <MiniStamp senderName={letter.sender.name} />
              </div>
            </div>

            {/* Title */}
            <h3
              className="font-serif text-base font-semibold leading-tight mb-2.5 line-clamp-2"
              style={{ color: '#2B4162', opacity: isLocked && !isOutbox ? 0.6 : 1 }}
            >
              {isLocked && !isOutbox
                ? '· · · (Locked until delivery)'
                : isLost
                  ? '⚠️ Lost in transit'
                  : isReturned
                    ? `🐦💨 Returned: ${letter.title}`
                    : letter.title}
            </h3>

            {/* Status row */}
            <div className="flex items-center justify-between">
              {isLocked ? (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(26,139,157,0.1)', color: '#1A8B9D' }}
                >
                  ⏳ {isOutbox ? `In flight (${formatCountdown(ms)})` : formatCountdown(ms)}
                </span>
              ) : isReturned ? (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,81,47,0.12)', color: '#C0391B' }}
                >
                  🐦 Returned (+75 refunded)
                </span>
              ) : isLost ? (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,81,47,0.1)', color: '#C0391B' }}
                >
                  💨 Lost
                </span>
              ) : isOpened ? (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(43,65,98,0.06)', color: 'rgba(43,65,98,0.45)' }}
                >
                  ✓ Opened
                </span>
              ) : isOutbox ? (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(26,139,157,0.12)', color: '#1A8B9D' }}
                >
                  📬 Delivered
                </span>
              ) : (
                <span
                  className="font-sans text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: '#FF512F', color: 'white' }}
                >
                  ✉ New
                </span>
              )}

              <span
                className="font-sans text-[10px]"
                style={{ color: 'rgba(43,65,98,0.4)' }}
              >
                {new Date(letter.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Resend button for Returned pigeon letters in Outbox */}
            {isOutbox && isReturned && onResend && (
              <div className="mt-3 pt-2.5 border-t border-[rgba(255,81,47,0.18)] flex items-center justify-between">
                <span className="font-sans text-[11px] font-medium" style={{ color: '#C0391B' }}>
                  Journey interrupted
                </span>
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onResend(letter.id);
                  }}
                  disabled={isResending}
                  className="px-3.5 py-1.5 rounded-full font-sans text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)',
                    boxShadow: '0 2px 8px rgba(255,81,47,0.35)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                >
                  {isResending ? (
                    <>
                      <motion.span
                        className="w-3 h-3 rounded-full border-2 border-white border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      <span>Dispatching…</span>
                    </>
                  ) : (
                    <>
                      <span>🐦 Resend (150 🪙)</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InboxClient({ activeUser, allUsers, letters }: Props) {
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');
  const [showKeyBackup, setShowKeyBackup] = useState(false);
  const [coins, setCoins] = useState(activeUser.pigeonCoins);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);

  const [lettersList, setLettersList] = useState<LetterSummary[]>(letters);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Sync state if props change
  useEffect(() => {
    setLettersList(letters);
  }, [letters]);

  // Filter letters for Inbox vs Outbox (Inbox: DELIVERED only for true blind delivery)
  const inboxLetters = lettersList.filter(
    (l) => l.recipientId === activeUser.id && l.status === 'DELIVERED'
  );
  const outboxLetters = lettersList.filter(
    (l) => l.senderId === activeUser.id
  );

  const displayedLetters = tab === 'inbox' ? inboxLetters : outboxLetters;
  const unread = inboxLetters.filter((l) => !l.openedAt && l.status === 'DELIVERED').length;

  // Auto daily check-in on mount
  useEffect(() => {
    async function checkIn() {
      try {
        const res = await fetch('/api/economy/check-in', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (!data.alreadyCheckedIn && data.granted) {
            setCoins(data.pigeonCoins);
            setCheckinMessage(data.message);
            setTimeout(() => setCheckinMessage(null), 4000);
          } else {
            setCoins(data.pigeonCoins);
          }
        }
      } catch {
        // Silently fail
      }
    }
    void checkIn();
  }, []);

  async function handleResend(letterId: string) {
    if (resendingId) return;
    setResendingId(letterId);
    setFeedbackToast(null);

    try {
      const res = await fetch(`/api/letters/${letterId}/resend`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedbackToast({
          type: 'error',
          message: data.error ?? 'Failed to resend letter.',
        });
        setTimeout(() => setFeedbackToast(null), 4000);
        return;
      }

      if (data.pigeonCoins !== undefined) {
        setCoins(data.pigeonCoins);
      }

      // Update letter in state
      setLettersList((prev) =>
        prev.map((l) => (l.id === letterId ? { ...l, ...data.letter } : l)),
      );

      setFeedbackToast({
        type: 'success',
        message: 'Pigeon dispatched again! 🐦',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch {
      setFeedbackToast({
        type: 'error',
        message: 'Network error while attempting to resend.',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 safe-top">
        <div
          className="relative z-20 px-4 py-3 flex items-center justify-between"
          style={{
            background: 'rgba(138,163,194,0.3)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(253,245,230,0.25)',
          }}
        >
          <div>
            <h1 className="font-serif text-lg font-bold leading-none" style={{ color: '#2B4162' }}>
              Sunset Messages
            </h1>
            <p className="font-sans text-xs mt-0.5" style={{ color: 'rgba(43,65,98,0.55)' }}>
              {unread > 0 ? `${unread} new letter${unread > 1 ? 's' : ''} 🌅` : 'Your letters'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Coin display */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full glass">
              <span style={{ fontSize: 11 }}>🐦</span>
              <span className="font-sans text-xs font-bold" style={{ color: '#2B4162' }}>
                {coins}
              </span>
            </div>
            <motion.button
              onClick={() => setShowKeyBackup((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center glass text-xs cursor-pointer"
              style={{ color: '#2B4162' }}
              whileTap={{ scale: 0.92 }}
              title="Key Management & Backup"
              aria-label="Key Management"
            >
              🔐
            </motion.button>
            <UserSwitcher activeUserId={activeUser.id} />
          </div>
        </div>

        {/* Key Backup drawer */}
        <AnimatePresence>
          {showKeyBackup && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative z-15 overflow-hidden glass-teal border-b"
              style={{ borderColor: 'rgba(26,139,157,0.2)' }}
            >
              <KeyBackup />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar (Inbox / Outbox) */}
        <div
          className="relative z-10 flex px-4 pt-2 pb-0 gap-1"
          style={{
            background: 'rgba(138,163,194,0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {(['inbox', 'outbox'] as const).map((t) => {
            const count = t === 'inbox' ? inboxLetters.length : outboxLetters.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 py-2 font-sans text-sm font-semibold capitalize rounded-t-lg transition-colors flex items-center justify-center gap-1.5"
                style={{
                  color: tab === t ? '#1A8B9D' : 'rgba(43,65,98,0.5)',
                }}
                aria-selected={tab === t}
                role="tab"
              >
                <span>{t}</span>
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
                  style={{
                    background: tab === t ? 'rgba(26,139,157,0.15)' : 'rgba(43,65,98,0.08)',
                    color: tab === t ? '#1A8B9D' : 'rgba(43,65,98,0.45)',
                  }}
                >
                  {count}
                </span>
                {tab === t && (
                  <motion.div
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ background: '#1A8B9D' }}
                    layoutId="tab-indicator"
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 py-2 pb-24">
        {/* Daily check-in toast */}
        <AnimatePresence>
          {checkinMessage && (
            <motion.div
              className="mx-4 mb-3 px-4 py-3 rounded-2xl text-center font-sans text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, rgba(255,209,148,0.5) 0%, rgba(26,139,157,0.2) 100%)',
                color: '#2B4162',
                border: '1px solid rgba(26,139,157,0.2)',
              }}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
            >
              ☀️ {checkinMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Toast for Resend / Actions */}
        <AnimatePresence>
          {feedbackToast && (
            <motion.div
              className="mx-4 mb-3 px-4 py-3 rounded-2xl text-center font-sans text-sm font-semibold shadow-md"
              style={{
                background:
                  feedbackToast.type === 'error'
                    ? 'rgba(255,81,47,0.15)'
                    : 'linear-gradient(135deg, rgba(255,209,148,0.5) 0%, rgba(26,139,157,0.25) 100%)',
                color: feedbackToast.type === 'error' ? '#C0391B' : '#2B4162',
                border: `1px solid ${feedbackToast.type === 'error' ? 'rgba(255,81,47,0.3)' : 'rgba(26,139,157,0.25)'}`,
              }}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
            >
              {feedbackToast.type === 'error' ? '⚠️ ' : '🕊️ '}
              {feedbackToast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification prompt */}
        <NotificationPrompt />

        {/* Daily Question Widget & History */}
        <DailyQuestionWidget />

        <div className="px-4">
        <AnimatePresence mode="wait">
          {displayedLetters.length === 0 ? (
            <motion.div
              key={tab === 'inbox' ? 'empty-inbox' : 'empty-outbox'}
              className="flex flex-col items-center justify-center py-16 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="text-5xl mb-3">{tab === 'inbox' ? '📭' : '✉️'}</div>
              <h2
                className="font-serif text-lg font-semibold mb-1"
                style={{ color: '#2B4162' }}
              >
                {tab === 'inbox' ? 'No letters received yet' : 'No letters sent yet'}
              </h2>
              <p
                className="font-sans text-xs max-w-xs"
                style={{ color: 'rgba(43,65,98,0.55)' }}
              >
                {tab === 'inbox'
                  ? 'Letters sent to you by Sun or Moon will arrive here.'
                  : 'Tap the compose button below to write your first letter.'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              className="grid gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {displayedLetters.map((letter, i) => (
                <EnvelopeCard
                  key={letter.id}
                  letter={letter}
                  index={i}
                  isOutbox={tab === 'outbox'}
                  onResend={handleResend}
                  isResending={resendingId === letter.id}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* ── Compose FAB ────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 safe-bottom">
        <Link href="/compose" aria-label="Compose new letter">
          <motion.div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)',
              boxShadow: '0 8px 24px rgba(255,81,47,0.4)',
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            ✍️
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
