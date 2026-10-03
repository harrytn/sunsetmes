'use client';

import { useState } from 'react';
import { exportKeyWithPassphrase, importKeyWithPassphrase, exportPublicKeyJwk } from '@/lib/crypto-client';
import { storeKeypair } from '@/lib/crypto-idb';
import { useCrypto } from '@/context/CryptoContext';

type Mode = 'idle' | 'export' | 'import';

export default function KeyBackup() {
  const { keypair, reinit, userId } = useCrypto();
  const [mode, setMode] = useState<Mode>('idle');
  const [passphrase, setPassphrase] = useState('');
  const [blob, setBlob] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportKey() {
    if (!keypair || !passphrase) return;
    setBusy(true); setStatus('');
    try {
      setBlob(await exportKeyWithPassphrase(keypair.privateKey, passphrase));
      setStatus('Copy this backup string and keep it somewhere private.');
    } catch (cause) { setStatus(`Export failed: ${(cause as Error).message}`); }
    finally { setBusy(false); }
  }

  async function importKey() {
    if (!blob || !passphrase) return;
    setBusy(true); setStatus('');
    try {
      if (!userId) throw new Error('Open a profile before importing a key.');
      const imported = await importKeyWithPassphrase(blob.trim(), passphrase);
      const response = await fetch('/api/users/public-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: await exportPublicKeyJwk(imported.publicKey), replace: true }),
      });
      if (!response.ok) throw new Error('Could not publish the restored public key.');
      await storeKeypair(userId, imported);
      reinit();
      setStatus('Key restored. Your letters can now be read on this device.');
      setMode('idle');
    } catch (cause) { setStatus(`Import failed: ${(cause as Error).message}`); }
    finally { setBusy(false); }
  }

  return <div>
    <p className="eyebrow">Private letters</p>
    <h2 className="section-title" style={{ fontSize: 28 }}>Your encryption key</h2>
    <p className="small-copy">Back up your key before moving to another device. Each profile has its own key.</p>
    {mode === 'idle' ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
      <button className="action action--primary" onClick={() => { setMode('export'); setStatus(''); }}>Back up key</button>
      <button className="action action--quiet" onClick={() => { setMode('import'); setBlob(''); setStatus(''); }}>Restore key</button>
    </div> : <div className="form-stack" style={{ maxWidth: 680, marginTop: 22 }}>
      <div><label className="field-label" htmlFor="key-passphrase">Backup passphrase</label><input id="key-passphrase" className="field" type="password" value={passphrase} onChange={event => setPassphrase(event.target.value)} /><p className="field-help">Use at least eight characters.</p></div>
      {mode === 'import' && <div><label className="field-label" htmlFor="key-backup-blob">Backup string</label><textarea id="key-backup-blob" className="field" value={blob} onChange={event => setBlob(event.target.value)} /></div>}
      {mode === 'export' && blob && <div><label className="field-label" htmlFor="key-backup-output">Your backup string</label><textarea id="key-backup-output" className="field" readOnly value={blob} /><button className="action action--quiet" style={{ marginTop: 10 }} onClick={() => void navigator.clipboard.writeText(blob)}>Copy backup string</button></div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="action action--primary" disabled={busy || passphrase.length < 8 || (mode === 'import' && !blob)} onClick={() => void (mode === 'export' ? exportKey() : importKey())}>{busy ? 'Working…' : mode === 'export' ? 'Create backup' : 'Restore key'}</button>
        <button className="action action--quiet" onClick={() => { setMode('idle'); setPassphrase(''); setBlob(''); setStatus(''); }}>Cancel</button>
      </div>
    </div>}
    {status && <p role="status" className="status-note" style={{ marginTop: 18 }}>{status}</p>}
  </div>;
}
