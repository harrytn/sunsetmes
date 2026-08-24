'use client';

/**
 * components/Envelope3D.tsx
 *
 * Realistic physical mail envelope with:
 *   • Postage Stamp (☀️ Sun / 🌙 Moon dynamic design with postmark cancellation lines)
 *   • Top-Left Return Address (addressFrom)
 *   • Center Destination Address (addressTo)
 *   • 3D interactive flap folding & wax seal breaking
 *   • Letter paper sliding up upon opening
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvelopeProps {
  /** Delivery status */
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  /** Whether the content is time-locked on the server */
  locked: boolean;
  /** Sender display name */
  senderName: string;
  /** Recipient display name */
  recipientName?: string;
  /** Return address */
  addressFrom?: string;
  /** Destination address */
  addressTo?: string;
  /** Letter title (visible even when locked) */
  title: string;
  /** Wax seal hex color */
  waxSealColor?: string;
  /** Delivery type label */
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  /** Time until delivery in ms (for locked letters) */
  msUntilDelivery?: number;
  /** Callback fired when the envelope is fully opened */
  onOpen?: () => void;
  /** Child = the letter content rendered inside */
  children?: React.ReactNode;
}

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const flapVariants: Variants = {
  closed: {
    rotateX: 0,
    z: 0,
    transition: { type: 'spring', stiffness: 90, damping: 18 },
  },
  open: {
    rotateX: -180,
    z: 20,
    transition: { type: 'spring', stiffness: 70, damping: 16, delay: 0.05 },
  },
};

const sealVariants: Variants = {
  closed: { scale: 1, opacity: 1 },
  open: {
    scale: 1.4,
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

const letterVariants: Variants = {
  hidden: { y: 0, opacity: 0, scale: 0.97 },
  visible: {
    y: -140,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 55,
      damping: 14,
      delay: 0.35,
    },
  },
};

const overlayVariants: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0, transition: { duration: 0.3 } },
};

// ─── Postage Stamp Component ─────────────────────────────────────────────────

export function PostageStamp({ senderName }: { senderName: string }) {
  const isSun = senderName.toLowerCase().includes('sun') || !senderName.toLowerCase().includes('moon');

  return (
    <div className="relative select-none pointer-events-none">
      {/* Stamp Body */}
      <div
        className="w-16 h-20 rounded-[2px] p-1 shadow-sm flex flex-col justify-between items-center relative overflow-hidden"
        style={{
          background: isSun
            ? 'linear-gradient(145deg, #FF6B4A 0%, #FFA834 100%)'
            : 'linear-gradient(145deg, #2B4162 0%, #5E7EA8 100%)',
          border: '2px dashed rgba(253, 245, 230, 0.85)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="w-full flex justify-between items-center text-[7px] font-sans font-extrabold uppercase tracking-widest text-[#FDF5E6]/90 px-0.5">
          <span>{isSun ? 'SUN' : 'LUNA'}</span>
          <span>50¢</span>
        </div>

        {/* Center Emblem */}
        <div className="flex-1 flex flex-col items-center justify-center -my-1">
          <span className="text-xl filter drop-shadow-sm">
            {isSun ? '☀️' : '🌙'}
          </span>
          <span
            className="font-serif text-[7px] font-bold tracking-wider text-[#FDF5E6] mt-0.5 uppercase text-center leading-none"
          >
            {isSun ? 'Sunset Air' : 'Night Sky'}
          </span>
        </div>

        {/* Footer */}
        <div className="w-full text-center text-[6px] font-sans font-bold tracking-tighter text-[#FDF5E6]/80 border-t border-[#FDF5E6]/30 pt-0.5">
          POSTAGE PAID
        </div>
      </div>

      {/* Postmark Ink Stamp Overlay */}
      <div
        className="absolute -top-1 -right-3 pointer-events-none opacity-60"
        style={{ transform: 'rotate(-12deg)' }}
      >
        <svg width="84" height="48" viewBox="0 0 84 48" fill="none">
          {/* Circular postal seal */}
          <circle cx="24" cy="24" r="18" stroke="#2B4162" strokeWidth="1.2" strokeDasharray="3 1.5" />
          <text x="24" y="22" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#2B4162" fontFamily="sans-serif">
            {isSun ? 'SUNSET' : 'LUNAR'}
          </text>
          <text x="24" y="28" textAnchor="middle" fontSize="4.5" fill="#2B4162" fontFamily="sans-serif">
            MAIL
          </text>
          {/* Wavy cancellation ink lines */}
          <path
            d="M 44 14 Q 54 8 64 14 T 84 14"
            stroke="#2B4162"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 44 24 Q 54 18 64 24 T 84 24"
            stroke="#2B4162"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 44 34 Q 54 28 64 34 T 84 34"
            stroke="#2B4162"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deliveryIcon(type: EnvelopeProps['deliveryType']) {
  if (type === 'EXPRESS') return '⚡';
  if (type === 'PIGEON') return '🐦';
  return '✉️';
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Arriving…';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${totalSec % 60}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Envelope3D({
  status,
  locked,
  senderName,
  recipientName,
  addressFrom,
  addressTo,
  title,
  waxSealColor = '#1A8B9D',
  deliveryType,
  msUntilDelivery = 0,
  onOpen,
  children,
}: EnvelopeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(msUntilDelivery);

  // Live countdown ticker
  React.useEffect(() => {
    if (!locked || msUntilDelivery <= 0) return;
    setCountdown(msUntilDelivery);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked, msUntilDelivery]);

  function handleTap() {
    if (locked) return;
    if (isOpen) return;
    setIsOpen(true);
    setTimeout(() => onOpen?.(), 700);
  }

  const canOpen = !locked && status !== 'IN_FLIGHT';
  const isLost = status === 'LOST';
  const isReturned = status === 'RETURNED';

  const defaultFrom = addressFrom || `From: ${senderName}\nSunset Post District`;
  const defaultTo = addressTo || `To: ${recipientName || 'Recipient'}\n${title ? `"${title}"` : 'Private Letter'}`;

  return (
    <div className="envelope-perspective w-full select-none">
      {/* ── Envelope Shell ─────────────────────────────────────────────── */}
      <motion.div
        className="relative mx-auto cursor-pointer"
        style={{ width: '100%', maxWidth: 350, height: 230 }}
        onClick={handleTap}
        whileTap={canOpen && !isOpen ? { scale: 0.97 } : {}}
      >
        {/* Back panel & Realistic Mail Face */}
        <div
          className="absolute inset-0 rounded-2xl paper-texture overflow-hidden"
          style={{
            background: isReturned
              ? 'linear-gradient(145deg, #FDF5E6 0%, #F5E0D0 100%)'
              : 'linear-gradient(145deg, #FDF5E6 0%, #F5EDD8 100%)',
            boxShadow: '0 12px 40px rgba(43,65,98,0.18), 0 2px 8px rgba(43,65,98,0.1)',
            border: '1px solid rgba(26,139,157,0.2)',
          }}
        >
          {/* Airmail Border Accent (top & bottom subtle stripes) */}
          <div
            className="w-full h-1 opacity-70"
            style={{
              background: 'repeating-linear-gradient(45deg, #FF512F, #FF512F 10px, #FDF5E6 10px, #FDF5E6 16px, #1A8B9D 16px, #1A8B9D 26px, #FDF5E6 26px, #FDF5E6 32px)',
            }}
          />

          {/* ── Top Row: Return Address (Left) & Postage Stamp (Right) ───── */}
          <div className="p-3.5 pt-2.5 flex justify-between items-start">
            {/* Top-Left: Return Address */}
            <div className="max-w-[170px] pr-2">
              <span
                className="font-sans text-[9px] font-bold tracking-widest uppercase block mb-0.5"
                style={{ color: 'rgba(43,65,98,0.45)' }}
              >
                RETURN TO:
              </span>
              <p
                className="font-serif text-[11px] leading-tight line-clamp-3 whitespace-pre-line"
                style={{ color: '#2B4162' }}
              >
                {defaultFrom}
              </p>
            </div>

            {/* Top-Right: Dynamic Postage Stamp */}
            <div className="pt-0.5">
              <PostageStamp senderName={senderName} />
            </div>
          </div>

          {/* ── Center: Destination Address Block ───────────────────────── */}
          <div className="px-6 py-2 flex flex-col items-center justify-center text-center">
            <div
              className="w-full max-w-[240px] px-3 py-2 rounded-xl"
              style={{
                background: 'rgba(253, 245, 230, 0.5)',
                border: '1px dashed rgba(43,65,98,0.2)',
              }}
            >
              <span
                className="font-sans text-[8px] font-bold tracking-widest uppercase block text-left"
                style={{ color: 'rgba(43,65,98,0.4)' }}
              >
                DELIVER TO:
              </span>
              <p
                className="font-serif text-sm font-bold leading-snug whitespace-pre-line text-left line-clamp-2 mt-0.5"
                style={{ color: '#2B4162' }}
              >
                {defaultTo}
              </p>
            </div>
          </div>

          {/* Bottom badge */}
          <div className="absolute bottom-2.5 left-3.5 z-10">
            <span
              className="glass-teal text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: '#1A8B9D', fontSize: 10 }}
            >
              {deliveryIcon(deliveryType)}{' '}
              {deliveryType === 'EXPRESS'
                ? 'Express'
                : deliveryType === 'PIGEON'
                ? 'Pigeon Post'
                : 'Standard Mail'}
            </span>
          </div>
        </div>

        {/* Bottom triangle fold lines */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none"
          style={{ height: '45%', borderRadius: '0 0 1rem 1rem' }}
        >
          <svg viewBox="0 0 350 100" className="w-full h-full" preserveAspectRatio="none">
            <polygon
              points="0,0 175,70 0,100"
              fill="rgba(26,139,157,0.05)"
              stroke="rgba(26,139,157,0.15)"
              strokeWidth="0.5"
            />
            <polygon
              points="350,0 175,70 350,100"
              fill="rgba(26,139,157,0.04)"
              stroke="rgba(26,139,157,0.15)"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        {/* ── Top Flap ─────────────────────────────────────────────────── */}
        <motion.div
          className="absolute top-0 left-0 right-0 overflow-hidden"
          style={{
            height: '52%',
            transformOrigin: 'top center',
            transformStyle: 'preserve-3d',
          }}
          variants={flapVariants}
          animate={isOpen ? 'open' : 'closed'}
        >
          <div
            className="w-full h-full glass rounded-t-2xl"
            style={{
              background:
                'linear-gradient(160deg, rgba(253,245,230,0.94) 0%, rgba(240,232,215,0.90) 100%)',
            }}
          >
            {/* Triangle V-shape on the flap */}
            <svg
              viewBox="0 0 350 110"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <polygon
                points="0,0 350,0 175,100"
                fill="rgba(26,139,157,0.06)"
                stroke="rgba(26,139,157,0.25)"
                strokeWidth="0.5"
              />
            </svg>
          </div>
        </motion.div>

        {/* ── Wax Seal ─────────────────────────────────────────────────── */}
        <motion.div
          className="absolute z-20"
          style={{
            top: '48%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          variants={sealVariants}
          animate={isOpen ? 'open' : 'closed'}
        >
          <div
            className="rounded-full flex items-center justify-center shadow-lg cursor-pointer"
            style={{
              width: 48,
              height: 48,
              background: `radial-gradient(circle at 35% 35%, ${waxSealColor}ee, ${waxSealColor}99)`,
              boxShadow: `0 4px 16px ${waxSealColor}55, 0 1px 3px rgba(0,0,0,0.2)`,
            }}
          >
            <span style={{ fontSize: 18 }}>🌅</span>
          </div>
        </motion.div>

        {/* ── Locked overlay ────────────────────────────────────────────── */}
        <AnimatePresence>
          {locked && (
            <motion.div
              className="absolute inset-0 rounded-2xl z-30 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(43,65,98,0.14)', backdropFilter: 'blur(2.5px)' }}
              variants={overlayVariants}
              initial="visible"
              exit="hidden"
            >
              <div className="glass rounded-xl px-4 py-3 text-center">
                <div className="text-xl mb-1">⏳</div>
                <div
                  className="font-sans text-xs font-semibold tracking-wide uppercase mb-1"
                  style={{ color: 'rgba(43,65,98,0.6)' }}
                >
                  Arriving in
                </div>
                <div
                  className="font-serif text-lg font-bold"
                  style={{ color: '#2B4162' }}
                >
                  {formatCountdown(countdown)}
                </div>
              </div>
            </motion.div>
          )}

          {isLost && (
            <motion.div
              className="absolute inset-0 rounded-2xl z-30 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(200,100,60,0.12)', backdropFilter: 'blur(2px)' }}
              variants={overlayVariants}
              initial="visible"
              exit="hidden"
            >
              <div className="glass rounded-xl px-4 py-3 text-center">
                <div className="text-2xl mb-1">💨</div>
                <div
                  className="font-serif text-base font-semibold"
                  style={{ color: '#C0391B' }}
                >
                  Pigeon Lost
                </div>
              </div>
            </motion.div>
          )}

          {isReturned && (
            <motion.div
              className="absolute inset-0 rounded-2xl z-30 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(200,100,60,0.12)', backdropFilter: 'blur(2px)' }}
              variants={overlayVariants}
              initial="visible"
              exit="hidden"
            >
              <div className="glass rounded-xl px-4 py-3 text-center">
                <div className="text-2xl mb-1">🐦💨</div>
                <div
                  className="font-serif text-base font-semibold"
                  style={{ color: '#C0391B' }}
                >
                  Returned
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Letter Paper (slides out) ─────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && children && (
          <motion.div
            className="relative mx-auto z-40 paper-texture rounded-2xl overflow-hidden"
            style={{
              width: '100%',
              maxWidth: 350,
              background: '#FDF5E6',
              boxShadow: '0 20px 60px rgba(43,65,98,0.2), 0 4px 12px rgba(43,65,98,0.1)',
              marginTop: -90,
            }}
            variants={letterVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Letter header */}
            <div
              className="px-6 pt-6 pb-3 border-b"
              style={{ borderColor: 'rgba(26,139,157,0.15)' }}
            >
              <h2
                className="font-serif text-xl font-semibold leading-snug"
                style={{ color: '#2B4162' }}
              >
                {title}
              </h2>
            </div>

            {/* Letter body */}
            <div className="px-6 py-5 font-serif text-base leading-relaxed" style={{ color: '#2B4162' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
