'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { recordDailyVisit } from '@/lib/daily-visit';
import Envelope3D from '@/components/Envelope3D';

type Person = { id: string; name: string; avatarColor: string };
type Letter = {
  id: string; title: string; waxSealColor: string;
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  deliverAt: string; openedAt: string | null; createdAt: string;
  distanceKm: number | null; pigeonNote: string | null; destAddress: string | null;
  content: string | null; addressFrom: string | null; addressTo: string | null;
  sender: Person; recipient: Person;
};

function formattedDate(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }

export default function LetterClient({ letter, activeUserId, locked, msUntilDelivery }: { letter: Letter; activeUserId: string; locked: boolean; msUntilDelivery: number }) {
  const isRecipient = letter.recipient.id === activeUserId;
  const legacyLetter = letter.content === null;

  useEffect(() => { void recordDailyVisit(activeUserId).catch(() => {}); }, [activeUserId]);

  function markOpened() {
    if (!isRecipient || letter.openedAt) return;
    void fetch(`/api/letters/${letter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open' }),
    }).catch(() => {});
  }

  return <div>
    <header className="site-header safe-top"><div className="page-shell site-header__inner"><Link href="/" className="brand"><span className="brand__name">Sunset Messages</span><span className="brand__tag">Your correspondence</span></Link><Link href="/" className="action action--quiet">Back to inbox</Link></div></header>
    <main className="page-shell page-main">
      <section className="page-intro page-intro--letter">
        <p className="eyebrow">{isRecipient ? `A letter from ${letter.sender.name}` : `A letter to ${letter.recipient.name}`}</p>
        <h1 className="display-title" style={{ maxWidth: 850, overflowWrap: 'anywhere' }}>{letter.title}</h1>
        <p className="small-copy">{isRecipient ? 'Arrived' : 'Sent'} {formattedDate(isRecipient ? letter.deliverAt : letter.createdAt)} · {letter.deliveryType.toLowerCase()} delivery · Letter text saved with your account</p>
      </section>
      {letter.deliveryType === 'PIGEON' && letter.distanceKm != null && <div className="status-note" style={{ marginBottom: 26 }}><strong>Pigeon journey</strong><div className="small-copy">{Math.round(letter.distanceKm).toLocaleString()} km{letter.destAddress ? ` to ${letter.destAddress}` : ''}</div>{letter.pigeonNote && <div className="small-copy">{letter.pigeonNote}</div>}</div>}
      {legacyLetter && <div role="status" className="status-note" style={{ marginBottom: 26 }}>This letter was sent before encryption was removed. Its original encrypted text is preserved, but this version of the app cannot display it.</div>}
      <div className="letter-stage">
        <Envelope3D status={letter.status} locked={locked} senderName={letter.sender.name} recipientName={letter.recipient.name} addressFrom={letter.addressFrom ?? undefined} addressTo={letter.addressTo ?? undefined} title={letter.title} deliveryType={letter.deliveryType} msUntilDelivery={msUntilDelivery} onOpen={markOpened}>
          {letter.content ?? 'This older letter cannot be displayed here.'}
        </Envelope3D>
      </div>
      {isRecipient ? <p className="small-copy" style={{ marginTop: 18 }}>Opening the envelope marks this letter as read.</p> : <p className="small-copy" style={{ marginTop: 18 }}>You sent this letter on {formattedDate(letter.createdAt)}{letter.status === 'IN_FLIGHT' ? '. It has not arrived yet.' : '.'}</p>}
    </main>
  </div>;
}
