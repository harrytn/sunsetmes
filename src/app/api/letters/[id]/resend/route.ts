/**
 * POST /api/letters/[id]/resend
 *
 * Allows a sender to retry dispatching a RETURNED pigeon letter.
 * Deducts 150 PigeonCoins, calculates a fresh flight duration & survival roll,
 * and resets the letter status back to IN_FLIGHT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { LetterStatus, TransactionType } from '@prisma/client';
import {
  haversineDistanceKm,
  flightDurationSeconds,
  rollSurvival,
  lostPigeonNote,
} from '@/lib/haversine';

const RESEND_COST = 150;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  // 1. Fetch letter and verify ownership
  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, name: true, pigeonCoins: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!letter) {
    return NextResponse.json({ error: 'Letter not found.' }, { status: 404 });
  }

  if (letter.senderId !== userId) {
    return NextResponse.json(
      { error: 'Only the sender can resend this letter.' },
      { status: 403 },
    );
  }

  if (letter.status !== LetterStatus.RETURNED) {
    return NextResponse.json(
      { error: 'Only returned letters can be resent.' },
      { status: 400 },
    );
  }

  // 2. Economy check
  if (letter.sender.pigeonCoins < RESEND_COST) {
    return NextResponse.json(
      {
        error: `Insufficient PigeonCoins. Resending costs ${RESEND_COST} coins (you have ${letter.sender.pigeonCoins}).`,
      },
      { status: 402 },
    );
  }

  // 3. Calculate distance and fresh flight parameters
  const now = new Date();
  let distanceKm = letter.distanceKm;

  if (
    letter.senderLat != null &&
    letter.senderLng != null &&
    letter.destLat != null &&
    letter.destLng != null
  ) {
    distanceKm = haversineDistanceKm(
      letter.senderLat,
      letter.senderLng,
      letter.destLat,
      letter.destLng,
    );
  } else if (!distanceKm) {
    distanceKm = 100; // fallback
  }

  const durationSec = flightDurationSeconds(distanceKm);
  const deliverAt = new Date(now.getTime() + durationSec * 1000);
  const { survived, rate } = rollSurvival(distanceKm);
  const pigeonNote = survived
    ? null
    : lostPigeonNote(letter.destAddress ?? 'Destination');

  // 4. Atomic transaction: deduct coins, log transaction, update letter
  const [updatedLetter, updatedUser] = await prisma.$transaction([
    prisma.letter.update({
      where: { id },
      data: {
        status: LetterStatus.IN_FLIGHT,
        deliverAt,
        flightDurationSec: durationSec,
        distanceKm,
        survivalRate: rate,
        pigeonSurvived: survived,
        pigeonNote,
        openedAt: null,
      },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        title: true,
        paperStyle: true,
        waxSealColor: true,
        deliveryType: true,
        status: true,
        deliverAt: true,
        openedAt: true,
        distanceKm: true,
        flightDurationSec: true,
        pigeonSurvived: true,
        pigeonNote: true,
        destAddress: true,
        createdAt: true,
        sender: { select: { id: true, name: true, avatarColor: true } },
        recipient: { select: { id: true, name: true, avatarColor: true } },
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { pigeonCoins: { decrement: RESEND_COST } },
      select: { id: true, pigeonCoins: true },
    }),
    prisma.transaction.create({
      data: {
        userId,
        letterId: id,
        amount: -RESEND_COST,
        type: TransactionType.DELIVERY_PIGEON,
        description: `Pigeon post retry: -${RESEND_COST} PigeonCoins → ${letter.destAddress ?? 'Destination'}`,
      },
    }),
  ]);

  return NextResponse.json({
    letter: updatedLetter,
    pigeonCoins: updatedUser.pigeonCoins,
    cost: RESEND_COST,
    message: 'Pigeon dispatched again! 🐦',
  });
}
