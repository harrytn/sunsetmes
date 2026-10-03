'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyLetterRecovery({ activeUserId }: { activeUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Restoring your older letters…');
  const [details, setDetails] = useState('');
  const [retryLabel, setRetryLabel] = useState('Check for restored letters');
  const [showBackup, setShowBackup] = useState(false);
  const [backup, setBackup] = useState('');
  const [passphrase, setPassphrase] = useState('');

  const restore = useCallback(async (extraKeys: CryptoKey[] = []) => {
    setBusy(true);
    setMessage('Restoring your older letters…');
    setDetails('');
    try {
      const { recoverLegacyLetters } = await import('@/lib/legacy-recovery-client');
      const result = await recoverLegacyLetters(activeUserId, extraKeys);
      const website = window.location.hostname;
      const savedKeyText = `${result.savedKeys} saved ${result.savedKeys === 1 ? 'key' : 'keys'}`;
      setDetails(`Website: ${website}. Found ${savedKeyText}. Restored ${result.restored} letters; ${result.remaining} still need recovery.`);
      setRetryLabel('Check for restored letters');
      if (!result.remaining) {
        setMessage('Your older letters are restored and available on all your devices.');
      } else if (result.rejectedLetters) {
        setMessage(`An original key unlocked ${result.matchedLetters} letters, but ${result.rejectedLetters} could not be read from the stored data. This needs a repair; repeatedly trying again will not fix it.`);
      } else if (result.keySearchIssue) {
        setMessage(result.keySearchIssue);
        setRetryLabel('Check this browser again');
      } else if (!result.savedKeys) {
        setMessage(`No original encryption key was found in this browser at ${website}. The old letters are still saved, but this browser has no key to unlock them.`);
      } else if (!result.matchedLetters) {
        setMessage(`Found ${savedKeyText} in this browser, but none matches your older letters. Use either person’s original browser at the original website address, or a saved backup.`);
      } else {
        setMessage(`${result.restored} older letters restored. The remaining letters need another original browser or backup.`);
      }
      // A different device may have restored the letters since this page loaded.
      if (result.restored || result.remaining === 0) router.refresh();
      return result;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The recovery check failed. Please try again.');
      setRetryLabel('Retry recovery');
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
      } else if (result && !result.rejectedLetters) {
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
    {details && <p className="small-copy">{details}</p>}
    {!busy && <>
      <p className="small-copy">Open the original Sunset Messages website in Safari or the home-screen app you used before. Keep the same website address. It will restore every letter it can unlock and save readable copies for both profiles, including this device.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="action action--primary" onClick={() => void restore()}>{retryLabel}</button>
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
