/**
 * app/letter/[id]/page.tsx  (Server Component)
 *
 * Fetches letter metadata server-side. Enforces the delivery lock.
 * Passes readable letter text to LetterClient after checking profile access
 * and delivery timing.
 */

import { notFound, redirect } from 'next/navigation';
import { getActiveUser } from '@/lib/session';
import prisma from '@/lib/prisma';
import LetterClient from './LetterClient';

export const metadata = { title: 'Letter | Sunset Messages' };

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
    select: {
      id: true, senderId: true, recipientId: true, title: true, waxSealColor: true,
      deliveryType: true, status: true, deliverAt: true, openedAt: true, createdAt: true,
      distanceKm: true, pigeonNote: true, destAddress: true,
      content: true, addressFrom: true, addressTo: true,
      sender: { select: { id: true, name: true, avatarColor: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!letter) notFound();

  if (letter.senderId !== activeUser.id && letter.recipientId !== activeUser.id) {
    redirect('/');
  }

  const now = new Date();
  const isRecipient = letter.recipientId === activeUser.id;
  const isDelivered = letter.deliverAt <= now;
  const locked = isRecipient && !isDelivered;

  // If letter is RETURNED or IN_FLIGHT, recipient may not view it (True Blind Delivery)
  if (isRecipient && (letter.status !== 'DELIVERED' && !(letter.status === 'IN_FLIGHT' && isDelivered))) {
    redirect('/');
  }

  const msUntilDelivery = isRecipient
    ? 0
    : Math.max(0, letter.deliverAt.getTime() - now.getTime());

  return (
    <LetterClient
      key={`${letter.id}:${activeUser.id}`}
      letter={JSON.parse(JSON.stringify({
        ...letter,
        status: isDelivered && letter.status === 'IN_FLIGHT' ? 'DELIVERED' : letter.status,
      }))}
      activeUserId={activeUser.id}
      locked={locked}
      msUntilDelivery={msUntilDelivery}
    />
  );
}
