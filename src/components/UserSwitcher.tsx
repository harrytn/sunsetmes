'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type UserProfile = { id: string; name: string; email: string; avatarColor: string; pigeonCoins: number };

export default function UserSwitcher({ activeUserId, users }: { activeUserId: string; users: UserProfile[] }) {
  const router = useRouter();
  const active = users.find(user => user.id === activeUserId);
  const others = users.filter(user => user.id !== activeUserId);
  const [expanded, setExpanded] = useState(false);
  const [targetId, setTargetId] = useState(others[0]?.id ?? '');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!active) return null;

  async function switchProfile(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/users/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, passcode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not switch profiles.');
      router.push('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not switch profiles.');
      setBusy(false);
    }
  }

  return <div className="switcher" onKeyDown={event => { if (event.key === 'Escape') setExpanded(false); }}>
    <button className="action action--quiet" aria-expanded={expanded} aria-controls="profile-switcher" onClick={() => setExpanded(value => !value)}>{active.name} · Switch</button>
    {expanded && <form id="profile-switcher" className="switcher__panel" onSubmit={switchProfile}>
      <h2 className="section-title" style={{ fontSize: 24, marginBottom: 16 }}>Switch profile</h2>
      <label className="field-label" htmlFor="switch-target">Profile</label>
      <select id="switch-target" className="field" value={targetId} onChange={event => setTargetId(event.target.value)}>
        {others.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
      <label className="field-label" htmlFor="switch-passcode" style={{ marginTop: 16 }}>Passcode</label>
      <input id="switch-passcode" className="field" type="password" autoComplete="current-password" value={passcode} onChange={event => setPasscode(event.target.value)} required />
      {error && <p role="alert" className="status-note status-note--error" style={{ marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        <button className="action action--primary" disabled={!targetId || !passcode || busy}>{busy ? 'Switching…' : 'Switch profile'}</button>
        <button className="action action--quiet" type="button" onClick={() => setExpanded(false)}>Cancel</button>
      </div>
    </form>}
  </div>;
}
