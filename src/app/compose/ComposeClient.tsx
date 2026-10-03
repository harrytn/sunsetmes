'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PigeonCalculator, { type PigeonResult } from '@/components/PigeonCalculator';
import { useCrypto } from '@/context/CryptoContext';
import { encryptLetter } from '@/lib/crypto-client';
import { recordDailyVisit } from '@/lib/daily-visit';

type DeliveryType = 'STANDARD' | 'EXPRESS' | 'PIGEON';
type Recipient = { id: string; name: string; avatarColor: string };
const OPTIONS: { type: DeliveryType; name: string; time: string; cost: number }[] = [
  { type: 'STANDARD', name: 'Standard', time: '14 days', cost: 50 },
  { type: 'EXPRESS', name: 'Express', time: '7 days', cost: 100 },
  { type: 'PIGEON', name: 'Pigeon', time: 'Based on distance', cost: 150 },
];

export default function ComposeClient({ activeUserId, recipients, pigeonCoins }: { activeUserId: string; recipients: Recipient[]; pigeonCoins: number }) {
  const router = useRouter();
  const { keypair, isReady } = useCrypto();
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [addressFrom, setAddressFrom] = useState('');
  const [addressTo, setAddressTo] = useState('');
  const [content, setContent] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('STANDARD');
  const [pigeonData, setPigeonData] = useState<PigeonResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [coins, setCoins] = useState(pigeonCoins);
  const [result, setResult] = useState<{ distanceKm: number; pigeonNote?: string } | null>(null);
  const cost = OPTIONS.find(option => option.type === deliveryType)?.cost ?? 50;

  useEffect(() => { void recordDailyVisit(activeUserId).then(visit => { if (visit) setCoins(visit.pigeonCoins); }).catch(() => {}); }, [activeUserId]);

  async function send() {
    setError('');
    if (!title.trim() || !content.trim()) { setError('Add a subject and your letter before sending.'); return; }
    if (coins < cost) { setError(`You need ${cost} PigeonCoins for this delivery. You have ${coins}.`); return; }
    if (deliveryType === 'PIGEON' && !pigeonData) { setError('Calculate the pigeon route before sending.'); return; }
    if (!keypair || !isReady) { setError('Your encryption key is still loading. Please try again in a moment.'); return; }

    setSending(true);
    try {
      const publicKeyResponse = await fetch(`/api/users/public-key?userId=${recipientId}`);
      if (!publicKeyResponse.ok) {
        const data = await publicKeyResponse.json();
        throw new Error(data.error ?? 'The recipient needs to open the app before you can send a letter.');
      }
      const { publicKey } = await publicKeyResponse.json() as { publicKey: string };
      const encrypted = await encryptLetter(content.trim(), publicKey, keypair, addressFrom.trim(), addressTo.trim(), deliveryType === 'PIGEON' ? pigeonData?.destAddress : undefined);
      const body: Record<string, unknown> = { recipientId, title: title.trim(), deliveryType, ...encrypted };
      if (deliveryType === 'PIGEON' && pigeonData) {
        body.senderLat = pigeonData.senderLat;
        body.senderLng = pigeonData.senderLng;
        body.destLat = pigeonData.destLat;
        body.destLng = pigeonData.destLng;
        body.destAddress = pigeonData.destAddress;
      }
      const response = await fetch('/api/letters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not send the letter.');
      setCoins(value => value - (data.cost ?? cost));
      if (deliveryType === 'PIGEON') {
        setResult({ distanceKm: data.distanceKm, pigeonNote: data.pigeonNote });
        window.setTimeout(() => router.push('/'), 4000);
      } else router.push('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the letter. Please try again.');
    } finally { setSending(false); }
  }

  if (result) return <main className="page-shell page-main" style={{ maxWidth: 740 }}><div className="panel panel--warm"><p className="eyebrow">On its way</p><h1 className="display-title">Your letter has begun its journey.</h1><p className="body-copy">The pigeon is traveling {Math.round(result.distanceKm).toLocaleString()} km. {result.pigeonNote ?? 'The route looks clear.'}</p><p className="small-copy">Returning to your letters shortly.</p><Link href="/" className="action action--primary">Go to inbox</Link></div></main>;

  return <div>
    <header className="site-header safe-top"><div className="page-shell site-header__inner"><Link href="/" className="brand"><span className="brand__name">Sunset Messages</span><span className="brand__tag">Your correspondence</span></Link><span className="small-copy">{coins} PigeonCoins available</span></div></header>
    <main className="page-shell page-main">
      <Link href="/" className="text-link">Back to letters</Link>
      <section className="page-intro page-intro--compose">
        <p className="eyebrow">The Sunset Post · A new letter</p>
        <h1 className="display-title">Write what matters.</h1>
        <p className="body-copy">Your letter travels slowly. Its body and written addresses are encrypted before it leaves this device.</p>
      </section>
      <div className="compose-grid">
        <div className="form-stack">
          <section className="panel form-stack">
            <h2 className="section-title" style={{ fontSize: 29 }}>The envelope</h2>
            <div><label className="field-label" htmlFor="recipient-select">To</label><select id="recipient-select" className="field" value={recipientId} onChange={event => setRecipientId(event.target.value)}>{recipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</select></div>
            <div><label className="field-label" htmlFor="letter-title">Subject</label><input id="letter-title" className="field" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /><p className="field-help">The subject is visible on the envelope.</p></div>
            <div className="form-row">
              <div><label className="field-label" htmlFor="address-from">Return address</label><input id="address-from" className="field" maxLength={100} value={addressFrom} onChange={event => setAddressFrom(event.target.value)} /><p className="field-help">Optional and encrypted.</p></div>
              <div><label className="field-label" htmlFor="address-to">Destination address</label><input id="address-to" className="field" maxLength={100} value={addressTo} onChange={event => setAddressTo(event.target.value)} /><p className="field-help">Optional and encrypted.</p></div>
            </div>
          </section>
          <section className="panel"><label className="field-label" htmlFor="letter-content">Your letter</label><textarea id="letter-content" className="field" rows={12} value={content} onChange={event => setContent(event.target.value)} placeholder="Begin your letter here…" style={{ font: '17px/1.7 Georgia, serif', minHeight: 300 }} /></section>
        </div>
        <aside style={{ minWidth: 0 }}>
          <section className="panel panel--warm">
            <p className="eyebrow">The journey</p><h2 className="section-title" style={{ fontSize: 29, marginBottom: 18 }}>Choose delivery</h2>
            <div className="choice-grid" style={{ gridTemplateColumns: '1fr' }}>
              {OPTIONS.map(option => <button key={option.type} className="choice" aria-pressed={deliveryType === option.type} disabled={coins < option.cost} onClick={() => setDeliveryType(option.type)}><span className="choice__name">{option.name}</span><span className="choice__meta">{option.time}</span><span className="choice__price">{option.cost} PigeonCoins</span></button>)}
            </div>
            {deliveryType === 'PIGEON' && <div style={{ borderTop: '1px solid var(--rule)', marginTop: 22, paddingTop: 22 }}><h3 className="section-title" style={{ fontSize: 24, marginBottom: 14 }}>Pigeon route</h3><PigeonCalculator onResult={setPigeonData} onClear={() => setPigeonData(null)} /></div>}
            {!isReady && <p role="status" className="status-note" style={{ marginTop: 18 }}>Preparing your encryption key…</p>}
            {coins < cost && <p className="status-note status-note--error" style={{ marginTop: 18 }}>You need {cost} PigeonCoins and currently have {coins}. Visit each day to earn more.</p>}
            {error && <p role="alert" className="status-note status-note--error" style={{ marginTop: 18 }}>{error}</p>}
            <button id="send-letter-btn" className="action action--primary" style={{ width: '100%', marginTop: 24 }} disabled={sending || !isReady || coins < cost} onClick={() => void send()}>{sending ? 'Encrypting and sending…' : `Send letter · ${cost} coins`}</button>
          </section>
        </aside>
      </div>
    </main>
  </div>;
}
