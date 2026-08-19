/**
 * app/api/cron/check-deliveries/route.ts
 *
 * POST /api/cron/check-deliveries
 * Secured with: Authorization: Bearer <CRON_SECRET>
 *
 * Finds all IN_FLIGHT letters whose deliverAt has passed. For each:
 *   • If pigeon survived (or not pigeon): mark DELIVERED, notify recipient.
 *   • If pigeon failed (pigeonSurvived === false): mark RETURNED,
 *     refund 50% (75 coins), notify sender.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push';
import { LetterStatus, TransactionType } from '@prisma/client';

const PIGEON_REFUND_AMOUNT = 75; // 50% of 150

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
      pigeonSurvived: true,
      pigeonNote: true,
      sender:    { select: { name: true } },
      recipient: { select: { name: true } },
    },
  });

  if (overdueLetters.length === 0) {
    return NextResponse.json({ updated: 0, delivered: 0, returned: 0, notified: 0 });
  }

  let delivered = 0;
  let returned = 0;
  let notified = 0;

  // ── Process each letter ──────────────────────────────────────────────────
  await Promise.allSettled(
    overdueLetters.map(async (letter) => {
      const isPigeonFailed =
        letter.deliveryType === 'PIGEON' && letter.pigeonSurvived === false;

      if (isPigeonFailed) {
        // ─── RETURNED: pigeon failed → return to sender + refund ─────────
        await prisma.$transaction([
          prisma.letter.update({
            where: { id: letter.id },
            data: { status: LetterStatus.RETURNED },
          }),
          prisma.user.update({
            where: { id: letter.senderId },
            data: { pigeonCoins: { increment: PIGEON_REFUND_AMOUNT } },
          }),
          prisma.transaction.create({
            data: {
              userId: letter.senderId,
              letterId: letter.id,
              amount: PIGEON_REFUND_AMOUNT,
              type: TransactionType.PIGEON_REFUND,
              description: `Pigeon failed — letter returned. +${PIGEON_REFUND_AMOUNT} coins refunded.`,
            },
          }),
        ]);
        returned++;

        // Notify the sender
        try {
          const sent = await sendPushNotification(letter.senderId, {
            title: '🐦💨 Pigeon returned your letter',
            body: `Your pigeon failed its journey. ${PIGEON_REFUND_AMOUNT} coins have been refunded.`,
            url: `/letter/${letter.id}`,
            tag: `letter-${letter.id}`,
            letterId: letter.id,
          });
          notified += sent;
        } catch {
          // Push errors must not fail the delivery update
        }
      } else {
        // ─── DELIVERED: standard, express, or successful pigeon ──────────
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
          ? `A letter from ${letter.sender.name} just flew in after a long journey.`
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
      }
    }),
  );

  return NextResponse.json({
    updated: overdueLetters.length,
    delivered,
    returned,
    notified,
  });
}
