'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyLetterRecovery({ activeUserId }: { activeUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Restoring your older letters…');
  const [showBackup, setShowBackup] = useState(false);
  const [backup, setBackup] = useState('');
  const [passphrase, setPassphrase] = useState('');

  const restore = useCallback(async (extraKeys: CryptoKey[] = []) => {
    setBusy(true);
    setMessage('Restoring your older letters…');
    try {
      const { recoverLegacyLetters } = await import('@/lib/legacy-recovery-client');
      const result = await recoverLegacyLetters(activeUserId, extraKeys);
      setMessage(result.remaining
        ? result.restored ? `${result.restored} older ${result.restored === 1 ? 'letter restored' : 'letters restored'}. The remaining letters need another original browser or backup.`
          : 'Your older letters need the original browser or a saved backup once.'
        : 'Your older letters are restored and available on all your devices.');
      // A different device may have restored the letters since this page loaded.
      if (result.restored || result.remaining === 0) router.refresh();
      return result;
    } catch {
      setMessage('The letters could not be saved right now. Check your connection and try again.');
      return null;
    } finally { setBusy(false); }
  }, [activeUserId, router]);

  useEffect(() => {
    const timer = setTimeout(() => void restore(), 0);
    return () => clearTimeout(timer);
  }, [restore]);

  async function restoreBackup() {
    setBusy(true);
    try {
      const { importLegacyBackup } = await import('@/lib/legacy-recovery-client');
      const key = await importLegacyBackup(backup, passphrase);
      const result = await restore([key]);
      if (result?.restored || result?.remaining === 0) {
        setBackup(''); setPassphrase(''); setShowBackup(false);
      } else if (result) {
        setMessage('This backup does not match the remaining letters. Try the other profile’s backup or the original Safari website.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Check the saved backup and try again.');
    } finally { setBusy(false); }
  }

  return <section className="panel" style={{ marginBottom: 24 }} aria-label="Restore older letters" aria-busy={busy}>
    <p className="eyebrow">Your saved correspondence</p>
    <h2 className="section-title" style={{ fontSize: 26 }}>Restore older letters</h2>
    <p className="small-copy" role="status">{message}</p>
    {!busy && <>
      <p className="small-copy">Open the original Sunset Messages website in Safari or the home-screen app you used before. Keep the same website address. It will restore every letter it can unlock and save readable copies for both profiles, including this device.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="action action--primary" onClick={() => void restore()}>Try again</button>
        <button className="action action--quiet" aria-expanded={showBackup} onClick={() => setShowBackup(value => !value)}>Use a saved backup</button>
      </div>
    </>}
    {showBackup && <form className="form-stack" style={{ marginTop: 20, maxWidth: 680 }} onSubmit={event => { event.preventDefault(); void restoreBackup(); }}>
      <p className="small-copy">Use a backup created in the old app and its backup passphrase. This restores old letters without enabling encryption for new ones.</p>
      <div><label className="field-label" htmlFor="legacy-backup">Saved backup</label><textarea id="legacy-backup" className="field" rows={3} value={backup} onChange={event => setBackup(event.target.value)} required disabled={busy} /></div>
      <div><label className="field-label" htmlFor="legacy-passphrase">Backup passphrase</label><input id="legacy-passphrase" className="field" type="password" value={passphrase} onChange={event => setPassphrase(event.target.value)} required disabled={busy} /></div>
      <button className="action action--primary" disabled={busy || !backup.trim() || !passphrase}>{busy ? 'Restoring…' : 'Restore letters'}</button>
    </form>}
  </section>;
}
