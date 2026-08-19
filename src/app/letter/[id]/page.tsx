/**
 * app/letter/[id]/page.tsx  (Server Component)
 *
 * Fetches letter metadata server-side. Enforces the delivery lock.
 * Passes encrypted fields to LetterClient for client-side decryption.
 *
 * E2EE: The server only stores/returns ciphertext. Decryption happens
 * entirely in the browser using the user's IndexedDB private key.
 */

import { notFound, redirect } from 'next/navigation';
import { getActiveUser } from '@/lib/session';
import prisma from '@/lib/prisma';
import LetterClient from './LetterClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const letter = await prisma.letter.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: letter ? `${letter.title} | Sunset Messages` : 'Letter | Sunset Messages' };
}

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activeUser = await getActiveUser();
  if (!activeUser) redirect('/');

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      sender:    { select: { id: true, name: true, avatarColor: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!letter) notFound();

  if (letter.senderId !== activeUser.id && letter.recipientId !== activeUser.id) {
    redirect('/');
  }

  // If letter is RETURNED, only sender may view it
  if (letter.status === 'RETURNED' && letter.recipientId === activeUser.id) {
    redirect('/');
  }

  const now = new Date();
  const isRecipient = letter.recipientId === activeUser.id;
  const isDelivered = letter.deliverAt <= now;
  const locked = isRecipient && !isDelivered;

  // Mark as opened on first view by recipient after delivery
  if (isRecipient && isDelivered && !letter.openedAt && letter.status === 'DELIVERED') {
    await prisma.letter.update({
      where: { id },
      data: { openedAt: now },
    });
  }

  // Strip encrypted payload fields that the recipient cannot yet decrypt
  const letterPayload = locked
    ? {
        ...letter,
        encryptedContent: null,
        encryptedKeyRecipient: null,
        // encryptedKeySender is kept — sender can preview their locked letter
      }
    : letter;

  const msUntilDelivery = locked
    ? Math.max(0, letter.deliverAt.getTime() - now.getTime())
    : 0;

  return (
    <LetterClient
      letter={JSON.parse(JSON.stringify(letterPayload))}
      activeUserId={activeUser.id}
      locked={locked}
      msUntilDelivery={msUntilDelivery}
    />
  );
}
