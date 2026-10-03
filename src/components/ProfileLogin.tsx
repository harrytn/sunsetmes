'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = { id: string; name: string; avatarColor: string };

export default function ProfileLogin({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(profiles[0]?.id ?? '');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/users/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, passcode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not unlock profile.');
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock profile.');
      setBusy(false);
    }
  }

  return <main className="login-layout">
    <div className="login-content">
      <p className="eyebrow">A quieter way to keep in touch</p>
      <h1 className="display-title">Sunset<br />Messages</h1>
      <p className="body-copy" style={{ marginBottom: 40 }}>A small place for the words that deserve time. Choose your profile to continue.</p>
      <form onSubmit={enter} className="form-stack" style={{ maxWidth: 380 }}>
        <div>
          <label className="field-label" htmlFor="profile">Your profile</label>
          <select id="profile" className="field" value={userId} onChange={e => setUserId(e.target.value)}>
            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="passcode">Passcode</label>
          <input id="passcode" className="field" type="password" autoComplete="current-password" value={passcode} onChange={e => setPasscode(e.target.value)} required />
        </div>
        {error && <p role="alert" className="status-note status-note--error" style={{ margin: 0 }}>{error}</p>}
        <button className="action action--primary" disabled={busy || !userId || !passcode}>{busy ? 'Opening your inbox…' : 'Open your inbox'}</button>
      </form>
    </div>
    <div className="login-visual" aria-hidden="true">
      <div className="login-art">
        <div className="login-art__masthead"><span>THE SUNSET POST</span><span>NO. 01 · EST. 2026</span></div>
        <div className="login-art__scene"><span className="login-art__sun" /><span className="login-art__horizon" /><span className="login-art__water" /></div>
        <p className="login-art__words">A little distance.<br /><em>A lot to say.</em></p>
        <div className="login-art__footer"><span>LETTERS FOR TWO</span><span>✳</span><span>DELIVERED WITH TIME</span></div>
      </div>
    </div>
  </main>;
}
