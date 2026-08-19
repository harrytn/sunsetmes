'use client';

/**
 * components/NotificationPrompt.tsx
 *
 * Subtle, dismissible notification permission pill.
 * Shown once at the top of the inbox. Dismissed state is persisted in
 * localStorage so it doesn't reappear after the user has made a choice.
 *
 * Flow:
 *   1. Check Notification.permission on mount.
 *   2. If "default" and not dismissed → show pill.
 *   3. On click → requestPermission() → register SW → subscribe → POST /api/notifications/subscribe
 *   4. If "denied" or dismissed → show nothing.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISS_KEY = 'sm_notif_dismissed';
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}


type PromptState = 'hidden' | 'visible' | 'loading' | 'done' | 'error';

export default function NotificationPrompt() {
  const [state, setState] = useState<PromptState>('hidden');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') {
      // Already granted — register SW silently
      registerAndSubscribe().catch(() => {/* ignore */});
      return;
    }
    // Show the prompt
    setState('visible');
  }, []);

  async function registerAndSubscribe() {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Check for existing subscription first
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    });

    const json = sub.toJSON();
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
  }

  async function handleEnable() {
    setState('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        localStorage.setItem(DISMISS_KEY, '1');
        setState('hidden');
        return;
      }
      await registerAndSubscribe();
      setState('done');
      setTimeout(() => setState('hidden'), 2500);
    } catch (e) {
      setErrorMsg((e as Error).message || 'Failed to enable notifications');
      setState('error');
      setTimeout(() => setState('hidden'), 3000);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setState('hidden');
  }

  return (
    <AnimatePresence>
      {state !== 'hidden' && (
        <motion.div
          key="notif-prompt"
          className="mx-4 mb-3"
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <div
            className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ border: '1px solid rgba(26,139,157,0.25)' }}
          >
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
              style={{ background: 'rgba(26,139,157,0.12)' }}
            >
              {state === 'done' ? '✓' : state === 'error' ? '⚠️' : '🔔'}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {state === 'done' ? (
                <p className="font-sans text-sm font-semibold" style={{ color: '#1A8B9D' }}>
                  Notifications enabled!
                </p>
              ) : state === 'error' ? (
                <p className="font-sans text-sm" style={{ color: '#C0391B' }}>
                  {errorMsg}
                </p>
              ) : (
                <>
                  <p className="font-sans text-sm font-semibold leading-tight" style={{ color: '#2B4162' }}>
                    Get notified when letters arrive
                  </p>
                  <p className="font-sans text-xs mt-0.5" style={{ color: 'rgba(43,65,98,0.55)' }}>
                    Never miss a pigeon landing 🐦
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            {state === 'visible' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  className="font-sans text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #FF512F, #F09819)' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleEnable}
                  id="enable-notifications-btn"
                >
                  Enable
                </motion.button>
                <motion.button
                  className="font-sans text-xs px-2 py-1.5 rounded-xl"
                  style={{ color: 'rgba(43,65,98,0.45)' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleDismiss}
                  aria-label="Dismiss notification prompt"
                >
                  ✕
                </motion.button>
              </div>
            )}

            {state === 'loading' && (
              <motion.div
                className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: '#1A8B9D', borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
