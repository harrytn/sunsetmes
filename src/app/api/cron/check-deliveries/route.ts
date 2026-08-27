/**
 * app/api/cron/check-deliveries/route.ts
 *
 * POST /api/cron/check-deliveries
 * Secured with: Authorization: Bearer <CRON_SECRET>
 *
 * Finds all IN_FLIGHT letters whose deliverAt has passed.
 * With the delay mechanic (and 100% survival rate), every letter that
 * reaches its deliverAt timestamp transitions directly to DELIVERED,
 * and a push notification is sent to the recipient.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push';
import { LetterStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // ── Find all overdue IN_FLIGHT letters ────────────────────────────────────
  const overdueLetters = await prisma.letter.findMany({
    where: {
      status: LetterStatus.IN_FLIGHT,
      deliverAt: { lte: now },
    },
    select: {
      id: true,
      title: true,
      deliveryType: true,
      senderId: true,
      recipientId: true,
      sender: { select: { name: true } },
      recipient: { select: { name: true } },
    },
  });

  if (overdueLetters.length === 0) {
    return NextResponse.json({ updated: 0, delivered: 0, notified: 0 });
  }

  let delivered = 0;
  let notified = 0;

  // ── Process each letter ──────────────────────────────────────────────────
  await Promise.allSettled(
    overdueLetters.map(async (letter) => {
      // Mark letter as DELIVERED
      await prisma.letter.update({
        where: { id: letter.id },
        data: { status: LetterStatus.DELIVERED },
      });
      delivered++;

      // Notify the recipient
      const isPigeon = letter.deliveryType === 'PIGEON';
      const pushTitle = isPigeon
        ? '🕊️ Your pigeon has landed!'
        : '💌 A letter has arrived!';
      const pushBody = isPigeon
        ? `A letter from ${letter.sender.name} just flew in after its journey.`
        : `${letter.sender.name} wrote you a letter — tap to read it.`;

      try {
        const sent = await sendPushNotification(letter.recipientId, {
          title: pushTitle,
          body: pushBody,
          url: `/letter/${letter.id}`,
          tag: `letter-${letter.id}`,
          letterId: letter.id,
        });
        notified += sent;
      } catch {
        // Push errors must not fail the delivery update
      }
    }),
  );

  return NextResponse.json({
    updated: overdueLetters.length,
    delivered,
    notified,
  });
}
