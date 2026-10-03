'use client';

import { useState } from 'react';

type Props = {
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  locked: boolean;
  senderName: string;
  recipientName?: string;
  addressFrom?: string;
  addressTo?: string;
  title: string;
  waxSealColor?: string;
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  msUntilDelivery?: number;
  onOpen?: () => void;
  children?: React.ReactNode;
};

function waitingTime(ms: number) {
  const hours = Math.ceil(ms / 3_600_000);
  if (hours >= 48) return `${Math.ceil(hours / 24)} days`;
  return `${Math.max(1, hours)} hours`;
}

export default function Envelope3D({ status, locked, senderName, recipientName, addressFrom, addressTo, title, deliveryType, msUntilDelivery = 0, onOpen, children }: Props) {
  const [open, setOpen] = useState(false);
  function openLetter() { if (locked || open) return; setOpen(true); onOpen?.(); }
  return <div>
    <button type="button" className="envelope" style={{ display: 'block', cursor: locked ? 'not-allowed' : 'pointer' }} onClick={openLetter} disabled={locked || open} aria-expanded={open} aria-label={locked ? `Letter arrives in ${waitingTime(msUntilDelivery)}` : open ? 'Letter opened' : `Open letter: ${title}`}>
      <span className="envelope__top">
        <span><span className="eyebrow">From</span><span style={{ display: 'block', whiteSpace: 'pre-line' }}>{addressFrom || senderName}</span></span>
        <span className="envelope__stamp" aria-hidden="true">S / M</span>
      </span>
      <span className="envelope__to"><span className="eyebrow">To</span><span style={{ display: 'block', whiteSpace: 'pre-line' }}>{addressTo || recipientName || 'Your person'}</span><span className="envelope__subject" style={{ display: 'block' }}>{title}</span></span>
      <span className="envelope__footer" style={{ display: 'block' }}>{locked ? `On its way · about ${waitingTime(msUntilDelivery)} remaining` : open ? 'Opened' : status === 'RETURNED' ? 'Returned · open to read' : `${deliveryType.toLowerCase()} delivery · open to read`}</span>
    </button>
    {open && <div className="letter-paper" aria-live="polite">{children}</div>}
  </div>;
}
