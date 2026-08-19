'use client';

/**
 * app/InboxClient.tsx
 *
 * Client-side inbox view with:
 * - Daily check-in (auto-calls /api/economy/check-in on mount)
 * - Daily Question Widget
 * - Envelope grid (inbox/outbox tabs)
 * - RETURNED letter badges in outbox
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

interface SenderInfo {
  id: string;
  name: string;
  avatarColor: string;
}

interface LetterSummary {
  id: string;
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
  sender: SenderInfo;
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

// ─── Envelope Card ────────────────────────────────────────────────────────────

function EnvelopeCard({
  letter,
  index,
  isOutbox,
}: {
  letter: LetterSummary;
  index: number;
  isOutbox?: boolean;
}) {
  const ms = msUntilDelivery(letter.deliverAt);
  const isLocked = ms > 0 && letter.status === 'IN_FLIGHT';
  const isLost = letter.status === 'LOST';
  const isReturned = letter.status === 'RETURNED';
  const isOpened = !!letter.openedAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
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
          }}
          whileHover={{ y: -3, boxShadow: '0 14px 40px rgba(43,65,98,0.18)' }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Envelope flap */}
          <div className="h-10 relative overflow-hidden">
            <svg viewBox="0 0 340 40" className="w-full h-full" preserveAspectRatio="none">
              <polygon
                points="0,0 340,0 170,36"
                fill={`${letter.waxSealColor}18`}
                stroke={`${letter.waxSealColor}40`}
                strokeWidth="0.5"
              />
            </svg>
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              style={{
                background: letter.waxSealColor,
                boxShadow: `0 2px 8px ${letter.waxSealColor}66`,
              }}
            >
              🌅
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: letter.sender.avatarColor }}
                >
                  {letter.sender.name[0]}
                </div>
                <span
                  className="font-sans text-xs font-medium"
                  style={{ color: 'rgba(43,65,98,0.6)' }}
                >
                  {letter.sender.name}
                </span>
              </div>
              <span className="text-sm">{deliveryIcon(letter.deliveryType)}</span>
            </div>

            {/* Title */}
            <h3
              className="font-serif text-base font-semibold leading-tight mb-2 line-clamp-2"
              style={{ color: '#2B4162', opacity: isLocked ? 0.5 : 1 }}
            >
              {isLocked
                ? '· · ·'
                : isLost
                  ? '⚠️ Lost in transit'
                  : isReturned
                    ? `🐦💨 ${letter.title}`
                    : letter.title}
            </h3>

            {/* Status row */}
            <div className="flex items-center justify-between">
              {isLocked ? (
                <span
                  className="font-sans text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(26,139,157,0.1)', color: '#1A8B9D' }}
                >
                  ⏳ {formatCountdown(ms)}
                </span>
              ) : isReturned ? (
                <span
                  className="font-sans text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,81,47,0.1)', color: '#C0391B' }}
                >
                  🐦 Returned
                </span>
              ) : isLost ? (
                <span
                  className="font-sans text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,81,47,0.1)', color: '#C0391B' }}
                >
                  💨 Pigeon lost
                </span>
              ) : isOpened ? (
                <span
                  className="font-sans text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(43,65,98,0.06)', color: 'rgba(43,65,98,0.45)' }}
                >
                  ✓ Opened
                </span>
              ) : (
                <span
                  className="font-sans text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: '#FF512F', color: 'white' }}
                >
                  ✉ New
                </span>
              )}

              <span
                className="font-sans text-[10px]"
                style={{ color: 'rgba(43,65,98,0.35)' }}
              >
                {new Date(letter.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
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
  const unread = letters.filter((l) => !l.openedAt && l.status === 'DELIVERED').length;

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
            // Auto-dismiss after 4 seconds
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
            <div className="flex items-center gap-1 px-2 py-1 rounded-full glass">
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

        {/* Tab bar */}
        <div
          className="relative z-10 flex px-4 pt-2 pb-0 gap-1"
          style={{
            background: 'rgba(138,163,194,0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {(['inbox', 'outbox'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative flex-1 py-2 font-sans text-sm font-medium capitalize rounded-t-lg transition-colors"
              style={{
                color: tab === t ? '#1A8B9D' : 'rgba(43,65,98,0.45)',
              }}
              aria-selected={tab === t}
              role="tab"
            >
              {t}
              {tab === t && (
                <motion.div
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ background: '#1A8B9D' }}
                  layoutId="tab-indicator"
                />
              )}
            </button>
          ))}
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

        {/* Notification prompt */}
        <NotificationPrompt />

        {/* Daily Question Widget */}
        <DailyQuestionWidget />

        <div className="px-4">
        <AnimatePresence mode="wait">
          {letters.length === 0 ? (
            <motion.div
              key="empty"
              className="flex flex-col items-center justify-center py-20 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-6xl mb-4">📭</div>
              <h2
                className="font-serif text-xl font-semibold mb-2"
                style={{ color: '#2B4162' }}
              >
                No letters yet
              </h2>
              <p
                className="font-sans text-sm max-w-xs"
                style={{ color: 'rgba(43,65,98,0.55)' }}
              >
                Write your first letter and choose a delivery method.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className="grid gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {letters.map((letter, i) => (
                <EnvelopeCard
                  key={letter.id}
                  letter={letter}
                  index={i}
                  isOutbox={tab === 'outbox'}
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
