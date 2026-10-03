'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCrypto } from '@/context/CryptoContext';
import { decryptLetter, type EncryptedLetterPayload } from '@/lib/crypto-client';
import { recordDailyVisit } from '@/lib/daily-visit';
import Envelope3D from '@/components/Envelope3D';

type Person = { id: string; name: string; avatarColor: string };
type Letter = {
  id: string; title: string; waxSealColor: string;
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  deliverAt: string; openedAt: string | null; createdAt: string;
  distanceKm: number | null; pigeonNote: string | null; destAddress: string | null;
  sender: Person; recipient: Person;
  encryptedContent: string | null; iv: string | null;
  encryptedKeyRecipient: string | null; encryptedKeySender: string | null;
};

function formattedDate(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }

export default function LetterClient({ letter, activeUserId, locked, msUntilDelivery }: { letter: Letter; activeUserId: string; locked: boolean; msUntilDelivery: number }) {
  const { keypair, isReady } = useCrypto();
  const isRecipient = letter.recipient.id === activeUserId;
  const [decryptState, setDecryptState] = useState<'idle' | 'decrypting' | 'done' | 'error'>('idle');
  const [content, setContent] = useState('');
  const [addressFrom, setAddressFrom] = useState<string | undefined>();
  const [addressTo, setAddressTo] = useState<string | undefined>();
  const [pigeonDestination, setPigeonDestination] = useState<string | undefined>();
  const [decryptError, setDecryptError] = useState('');

  useEffect(() => { void recordDailyVisit(activeUserId).catch(() => {}); }, [activeUserId]);
  useEffect(() => {
    if (!isReady || !keypair || locked || !letter.encryptedContent || !letter.iv) return;
    if (isRecipient && !letter.encryptedKeyRecipient || !isRecipient && !letter.encryptedKeySender) return;
    async function decrypt() {
      setDecryptState('decrypting');
      try {
        const payload: EncryptedLetterPayload = {
          encryptedContent: letter.encryptedContent!, iv: letter.iv!,
          encryptedKeyRecipient: letter.encryptedKeyRecipient ?? '', encryptedKeySender: letter.encryptedKeySender ?? '',
        };
        const result = await decryptLetter(payload, keypair!.privateKey, isRecipient);
        setContent(result.content);
        setAddressFrom(result.addressFrom);
        setAddressTo(result.addressTo);
        setPigeonDestination(result.pigeonDestination);
        setDecryptState('done');
      } catch (cause) {
        setDecryptError(cause instanceof Error ? cause.message : 'Could not decrypt this letter.');
        setDecryptState('error');
      }
    }
    void decrypt();
  // The letter content is immutable after dispatch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, keypair, locked, isRecipient]);

  function markOpened() {
    if (!isRecipient || letter.openedAt) return;
    void fetch(`/api/letters/${letter.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open' }) }).catch(() => {});
  }

  return <div>
    <header className="site-header safe-top"><div className="page-shell site-header__inner"><Link href="/" className="brand"><span className="brand__name">Sunset Messages</span><span className="brand__tag">Your correspondence</span></Link><Link href="/" className="action action--quiet">Back to inbox</Link></div></header>
    <main className="page-shell page-main">
      <section className="page-intro page-intro--letter">
        <p className="eyebrow">{isRecipient ? `A letter from ${letter.sender.name}` : `A letter to ${letter.recipient.name}`}</p>
        <h1 className="display-title" style={{ maxWidth: 850, overflowWrap: 'anywhere' }}>{letter.title}</h1>
        <p className="small-copy">{isRecipient ? 'Arrived' : 'Sent'} {formattedDate(isRecipient ? letter.deliverAt : letter.createdAt)} · {letter.deliveryType.toLowerCase()} delivery · Letter body encrypted</p>
      </section>
      {letter.deliveryType === 'PIGEON' && letter.distanceKm != null && <div className="status-note" style={{ marginBottom: 26 }}><strong>Pigeon journey</strong><div className="small-copy">{Math.round(letter.distanceKm).toLocaleString()} km{pigeonDestination || letter.destAddress ? ` to ${pigeonDestination ?? letter.destAddress}` : ''}</div>{letter.pigeonNote && <div className="small-copy">{letter.pigeonNote}</div>}</div>}
      {decryptState === 'error' && <p role="alert" className="status-note status-note--error" style={{ marginBottom: 26 }}>Could not read this letter: {decryptError}. Restore this profile’s encryption key if you are on a new device.</p>}
      <div className="letter-stage">
        <Envelope3D status={letter.status} locked={locked} senderName={letter.sender.name} recipientName={letter.recipient.name} addressFrom={addressFrom} addressTo={addressTo} title={letter.title} deliveryType={letter.deliveryType} msUntilDelivery={msUntilDelivery} onOpen={markOpened}>
          {decryptState === 'done' ? content : decryptState === 'error' ? 'This letter could not be decrypted.' : 'Decrypting your letter…'}
        </Envelope3D>
      </div>
      {isRecipient ? <p className="small-copy" style={{ marginTop: 18 }}>Opening the envelope marks this letter as read.</p> : <p className="small-copy" style={{ marginTop: 18 }}>You sent this letter on {formattedDate(letter.createdAt)}{letter.status === 'IN_FLIGHT' ? '. It has not arrived yet.' : '.'}</p>}
    </main>
  </div>;
}
