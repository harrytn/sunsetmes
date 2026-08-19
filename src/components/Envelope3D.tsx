'use client';

/**
 * components/Envelope3D.tsx
 *
 * Multi-layer Framer Motion envelope with:
 *   • Glass envelope body
 *   • Top flap that folds back (rotateX 0→-180deg)
 *   • Wax seal that cracks and fades
 *   • Letter paper that slides up out of the envelope
 *   • Locked overlay with countdown for IN_FLIGHT letters
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
    // Fire the onOpen callback after the letter slides up
    setTimeout(() => onOpen?.(), 700);
  }

  const canOpen = !locked && status !== 'IN_FLIGHT';
  const isLost = status === 'LOST';
  const isReturned = status === 'RETURNED';

  return (
    <div className="envelope-perspective w-full select-none">
      {/* ── Envelope Shell ─────────────────────────────────────────────── */}
      <motion.div
        className="relative mx-auto cursor-pointer"
        style={{ width: '100%', maxWidth: 340, height: 220 }}
        onClick={handleTap}
        whileTap={canOpen && !isOpen ? { scale: 0.97 } : {}}
      >
        {/* Back panel */}
        <div
          className="absolute inset-0 rounded-2xl paper-texture"
          style={{
            background: isReturned
              ? 'linear-gradient(145deg, #FDF5E6 0%, #F5E0D0 100%)'
              : 'linear-gradient(145deg, #FDF5E6 0%, #F5EDD8 100%)',
            boxShadow: '0 12px 40px rgba(43,65,98,0.18), 0 2px 8px rgba(43,65,98,0.1)',
          }}
        />

        {/* Bottom triangle fold lines */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden"
          style={{ height: '55%', borderRadius: '0 0 1rem 1rem' }}
        >
          <svg viewBox="0 0 340 120" className="w-full h-full" preserveAspectRatio="none">
            {/* Left flap */}
            <polygon
              points="0,0 170,80 0,120"
              fill="rgba(26,139,157,0.08)"
              stroke="rgba(26,139,157,0.2)"
              strokeWidth="0.5"
            />
            {/* Right flap */}
            <polygon
              points="340,0 170,80 340,120"
              fill="rgba(26,139,157,0.06)"
              stroke="rgba(26,139,157,0.2)"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        {/* Sender label */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-0.5 z-10">
          <span
            className="font-sans text-[10px] font-medium tracking-widest uppercase"
            style={{ color: 'rgba(43,65,98,0.5)' }}
          >
            From
          </span>
          <span
            className="font-serif text-sm font-semibold"
            style={{ color: '#2B4162' }}
          >
            {senderName}
          </span>
        </div>

        {/* Delivery type badge */}
        <div className="absolute top-3 left-3 z-10">
          <span
            className="glass-teal text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: '#1A8B9D', fontSize: 11 }}
          >
            {deliveryIcon(deliveryType)}{' '}
            {deliveryType === 'EXPRESS'
              ? 'Express'
              : deliveryType === 'PIGEON'
              ? 'Pigeon Post'
              : 'Standard Mail'}
          </span>
        </div>

        {/* ── Top Flap ─────────────────────────────────────────────────── */}
        <motion.div
          className="absolute top-0 left-0 right-0 overflow-hidden"
          style={{
            height: '55%',
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
                'linear-gradient(160deg, rgba(253,245,230,0.92) 0%, rgba(240,232,215,0.88) 100%)',
            }}
          >
            {/* Triangle V-shape on the flap */}
            <svg
              viewBox="0 0 340 120"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <polygon
                points="0,0 340,0 170,110"
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
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          variants={sealVariants}
          animate={isOpen ? 'open' : 'closed'}
        >
          <div
            className="rounded-full flex items-center justify-center shadow-lg"
            style={{
              width: 52,
              height: 52,
              background: `radial-gradient(circle at 35% 35%, ${waxSealColor}dd, ${waxSealColor}88)`,
              boxShadow: `0 4px 16px ${waxSealColor}55, 0 1px 3px rgba(0,0,0,0.2)`,
            }}
          >
            <span style={{ fontSize: 20 }}>🌅</span>
          </div>
        </motion.div>

        {/* ── Locked overlay ────────────────────────────────────────────── */}
        <AnimatePresence>
          {locked && (
            <motion.div
              className="absolute inset-0 rounded-2xl z-30 flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(43,65,98,0.12)', backdropFilter: 'blur(2px)' }}
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
              maxWidth: 340,
              background: '#FDF5E6',
              boxShadow: '0 20px 60px rgba(43,65,98,0.2), 0 4px 12px rgba(43,65,98,0.1)',
              marginTop: -100,
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
