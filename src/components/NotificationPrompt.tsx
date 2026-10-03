'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'sm_notif_dismissed';
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const result = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) result[i] = raw.charCodeAt(i);
  return result;
}

type State = 'hidden' | 'visible' | 'loading' | 'done' | 'error';

export default function NotificationPrompt({ activeUserId }: { activeUserId: string }) {
  const [state, setState] = useState<State>('hidden');
  const [error, setError] = useState('');

  async function registerAndSubscribe() {
    if (!VAPID_KEY) throw new Error('Notification setup is missing on this deployment.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const publicKey = urlBase64ToUint8Array(VAPID_KEY);
    let existing = await registration.pushManager.getSubscription();
    if (existing?.options.applicationServerKey) {
      const old = new Uint8Array(existing.options.applicationServerKey);
      if (old.length !== publicKey.length || old.some((byte, index) => byte !== publicKey[index])) {
        await existing.unsubscribe();
        existing = null;
      }
    }
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
    const json = subscription.toJSON();
    const ownerKey = `sm-push-owner-${json.endpoint}`;
    const savedKey = `sm-push-saved-${activeUserId}-${json.endpoint}`;
    if (localStorage.getItem(ownerKey) === activeUserId && Date.now() - Number(localStorage.getItem(savedKey) ?? 0) < 86_400_000) return;
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!response.ok) throw new Error('Could not save your notification subscription.');
    localStorage.setItem(ownerKey, activeUserId);
    localStorage.setItem(savedKey, String(Date.now()));
  }

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (localStorage.getItem(DISMISS_KEY) || Notification.permission === 'denied') return;
    const timer = window.setTimeout(() => {
      if (Notification.permission === 'granted') {
        void registerAndSubscribe().catch(cause => { setError(cause instanceof Error ? cause.message : 'Could not enable notifications.'); setState('error'); });
      } else setState('visible');
    }, 0);
    return () => window.clearTimeout(timer);
  // Register on profile change; the browser endpoint may belong to the other profile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  async function enable() {
    setState('loading');
    try {
      if (await Notification.requestPermission() !== 'granted') { setState('hidden'); return; }
      await registerAndSubscribe();
      setState('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable notifications.');
      setState('error');
    }
  }

  if (state === 'hidden') return null;
  return <section className="status-note" aria-label="Notifications" style={{ marginBottom: 28, display: 'flex', gap: 18, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
    <div>
      <strong>{state === 'done' ? 'Notifications are ready' : state === 'error' ? 'Notifications need attention' : 'An evening inbox reminder'}</strong>
      <p className="small-copy" style={{ margin: '3px 0 0' }}>{state === 'error' ? error : state === 'done' ? 'You can close this message.' : 'Get one alert when you have a new unread letter or have not visited today.'}</p>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(state === 'visible' || state === 'error') && <button className="action action--primary" onClick={() => void enable()}>{state === 'error' ? 'Retry' : 'Enable notifications'}</button>}
      {state === 'loading' && <span role="status">Setting up…</span>}
      {state !== 'loading' && <button className="action action--quiet" onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setState('hidden'); }}>Dismiss</button>}
    </div>
  </section>;
}
