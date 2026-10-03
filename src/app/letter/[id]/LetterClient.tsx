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
  const { keypair, isReady, error: cryptoError } = useCrypto();
  const isRecipient = letter.recipient.id === activeUserId;
  const [decryptState, setDecryptState] = useState<'waiting' | 'decrypting' | 'done' | 'error'>('waiting');
  const [content, setContent] = useState('');
  const [addressFrom, setAddressFrom] = useState<string | undefined>();
  const [addressTo, setAddressTo] = useState<string | undefined>();
  const [pigeonDestination, setPigeonDestination] = useState<string | undefined>();
  const [decryptError, setDecryptError] = useState('');
  const [envelopeOpened, setEnvelopeOpened] = useState(false);

  useEffect(() => { void recordDailyVisit(activeUserId).catch(() => {}); }, [activeUserId]);
  useEffect(() => {
    let cancelled = false;
    if (!isReady || !keypair || locked || !letter.encryptedContent || !letter.iv) return () => { cancelled = true; };
    if (isRecipient && !letter.encryptedKeyRecipient || !isRecipient && !letter.encryptedKeySender) return () => { cancelled = true; };

    const privateKey = keypair.privateKey;
    async function decrypt() {
      try {
        await Promise.resolve();
        if (cancelled) return;
        setDecryptState('decrypting');
        setContent('');
        setAddressFrom(undefined);
        setAddressTo(undefined);
        setPigeonDestination(undefined);
        setDecryptError('');
        const payload: EncryptedLetterPayload = {
          encryptedContent: letter.encryptedContent!, iv: letter.iv!,
          encryptedKeyRecipient: letter.encryptedKeyRecipient ?? '', encryptedKeySender: letter.encryptedKeySender ?? '',
        };
        const result = await decryptLetter(payload, privateKey, isRecipient);
        if (cancelled) return;
        setContent(result.content);
        setAddressFrom(result.addressFrom);
        setAddressTo(result.addressTo);
        setPigeonDestination(result.pigeonDestination);
        setDecryptState('done');
      } catch (cause) {
        if (cancelled) return;
        setDecryptError(cause instanceof Error ? cause.message : 'Could not decrypt this letter.');
        setDecryptState('error');
      }
    }
    void decrypt();
    return () => { cancelled = true; };
  }, [
    letter.id,
    letter.encryptedContent,
    letter.iv,
    letter.encryptedKeyRecipient,
    letter.encryptedKeySender,
    isReady,
    keypair,
    cryptoError,
    locked,
    isRecipient,
  ]);

  const unavailableReason = !isReady
    ? ''
    : !keypair
      ? cryptoError ?? 'Your encryption key is not available on this device.'
      : !letter.encryptedContent || !letter.iv
        ? 'This letter is missing its encrypted content or key data.'
        : isRecipient && !letter.encryptedKeyRecipient || !isRecipient && !letter.encryptedKeySender
          ? 'This letter is missing the encrypted key for this profile.'
          : '';
  const visibleDecryptState = unavailableReason ? 'error' : !isReady || locked ? 'waiting' : decryptState;
  const visibleDecryptError = unavailableReason || decryptError;

  useEffect(() => {
    if (!envelopeOpened || decryptState !== 'done' || !isRecipient || letter.openedAt) return;
    void fetch(`/api/letters/${letter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open' }),
    }).catch(() => {});
  }, [envelopeOpened, decryptState, isRecipient, letter.id, letter.openedAt]);

  function markOpened() {
    setEnvelopeOpened(true);
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
      {visibleDecryptState === 'error' && <div role="alert" className="status-note status-note--error" style={{ marginBottom: 26 }}><p style={{ margin: '0 0 8px' }}>Could not open this letter: {visibleDecryptError}</p><p style={{ margin: 0 }}>If you are on a new browser or device, return to your inbox, open <strong>Keys</strong>, and restore this profile’s encryption key backup.</p></div>}
      <div className="letter-stage">
        <Envelope3D status={letter.status} locked={locked} senderName={letter.sender.name} recipientName={letter.recipient.name} addressFrom={addressFrom} addressTo={addressTo} title={letter.title} deliveryType={letter.deliveryType} msUntilDelivery={msUntilDelivery} onOpen={markOpened}>
          {visibleDecryptState === 'done' ? content : visibleDecryptState === 'error' ? 'This letter could not be decrypted.' : visibleDecryptState === 'waiting' ? 'Preparing your encryption key…' : 'Decrypting your letter…'}
        </Envelope3D>
      </div>
      {isRecipient ? <p className="small-copy" style={{ marginTop: 18 }}>Opening the envelope marks this letter as read.</p> : <p className="small-copy" style={{ marginTop: 18 }}>You sent this letter on {formattedDate(letter.createdAt)}{letter.status === 'IN_FLIGHT' ? '. It has not arrived yet.' : '.'}</p>}
    </main>
  </div>;
}
