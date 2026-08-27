/**
 * app/api/letters/route.ts
 * GET  /api/letters  → list inbox + outbox (no encrypted payload)
 * POST /api/letters  → send an E2EE-encrypted letter
 *
 * Economy: All delivery methods now cost PigeonCoins (deducted on send).
 *   STANDARD: 50 coins, 14 days
 *   EXPRESS:  100 coins, 7 days
 *   PIGEON:   150 coins, distance-based
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import {
  haversineDistanceKm,
  calculatePigeonFlight,
} from '@/lib/haversine';
import { DeliveryType, LetterStatus, TransactionType } from '@prisma/client';

// ── Delivery cost map ─────────────────────────────────────────────────────────
const DELIVERY_COST: Record<DeliveryType, number> = {
  STANDARD: 50,
  EXPRESS: 100,
  PIGEON: 150,
};

// ─── GET – List Letters ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const box = searchParams.get('box') ?? 'inbox';

  const letterSelect = {
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
    sender:    { select: { id: true, name: true, avatarColor: true } },
    recipient: { select: { id: true, name: true, avatarColor: true } },
  };

  if (box === 'outbox') {
    const letters = await prisma.letter.findMany({
      where: { senderId: userId },
      select: letterSelect,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ letters });
  }

  // Inbox: only DELIVERED letters (True Blind Delivery - hides in-flight letters)
  const letters = await prisma.letter.findMany({
    where: {
      recipientId: userId,
      status: LetterStatus.DELIVERED,
    },
    select: letterSelect,
    orderBy: { deliverAt: 'asc' },
  });
  return NextResponse.json({ letters });
}

// ─── POST – Send an E2EE Letter ───────────────────────────────────────────────

export interface SendLetterBody {
  recipientId: string;
  title: string;
  paperStyle?: string;
  waxSealColor?: string;
  deliveryType: DeliveryType;

  // E2EE fields (required)
  encryptedContent: string;
  iv: string;
  encryptedKeyRecipient: string;
  encryptedKeySender: string;

  // Pigeon-only fields
  senderLat?: number;
  senderLng?: number;
  destAddress?: string;
  destLat?: number;
  destLng?: number;
}

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: SendLetterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    recipientId, title, deliveryType, paperStyle, waxSealColor,
    encryptedContent, iv, encryptedKeyRecipient, encryptedKeySender,
  } = body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!recipientId || !title?.trim() || !deliveryType) {
    return NextResponse.json(
      { error: 'recipientId, title, and deliveryType are required.' },
      { status: 400 },
    );
  }

  if (!encryptedContent || !iv || !encryptedKeyRecipient || !encryptedKeySender) {
    return NextResponse.json(
      { error: 'E2EE fields are required: encryptedContent, iv, encryptedKeyRecipient, encryptedKeySender.' },
      { status: 400 },
    );
  }

  if (recipientId === userId) {
    return NextResponse.json({ error: 'You cannot send a letter to yourself.' }, { status: 400 });
  }

  const [recipient, sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: recipientId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found.' }, { status: 404 });
  }
  if (!sender) {
    return NextResponse.json({ error: 'Sender not found.' }, { status: 404 });
  }

  // ── Balance check ─────────────────────────────────────────────────────────
  const cost = DELIVERY_COST[deliveryType];
  if (sender.pigeonCoins < cost) {
    return NextResponse.json(
      { error: `Insufficient PigeonCoins. ${deliveryType} delivery costs ${cost} coins (you have ${sender.pigeonCoins}).` },
      { status: 402 },
    );
  }

  const now = new Date();
  const baseLetterData = {
    senderId: userId,
    recipientId,
    title,
    encryptedContent,
    iv,
    encryptedKeyRecipient,
    encryptedKeySender,
    paperStyle: paperStyle ?? 'classic-sand',
    waxSealColor: waxSealColor ?? '#1A8B9D',
  };

  const txnType: Record<DeliveryType, TransactionType> = {
    STANDARD: TransactionType.DELIVERY_STANDARD,
    EXPRESS: TransactionType.DELIVERY_EXPRESS,
    PIGEON: TransactionType.DELIVERY_PIGEON,
  };

  // ── STANDARD (14 days, 50 coins) ──────────────────────────────────────────
  if (deliveryType === DeliveryType.STANDARD) {
    const deliverAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const [letter] = await prisma.$transaction([
      prisma.letter.create({
        data: {
          ...baseLetterData,
          deliveryType: DeliveryType.STANDARD,
          status: LetterStatus.IN_FLIGHT,
          deliverAt,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pigeonCoins: { decrement: cost } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -cost,
          type: txnType.STANDARD,
          description: `Standard delivery: -${cost} PigeonCoins`,
        },
      }),
    ]);
    return NextResponse.json({ letter, cost, message: 'Standard letter dispatched!' }, { status: 201 });
  }

  // ── EXPRESS (7 days, 100 coins) ───────────────────────────────────────────
  if (deliveryType === DeliveryType.EXPRESS) {
    const deliverAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [letter] = await prisma.$transaction([
      prisma.letter.create({
        data: {
          ...baseLetterData,
          deliveryType: DeliveryType.EXPRESS,
          status: LetterStatus.IN_FLIGHT,
          deliverAt,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pigeonCoins: { decrement: cost } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -cost,
          type: txnType.EXPRESS,
          description: `Express delivery: -${cost} PigeonCoins`,
        },
      }),
    ]);
    return NextResponse.json({ letter, cost, message: 'Express letter dispatched!' }, { status: 201 });
  }

  // ── PIGEON (distance-based with 30% chance of 25% weather delay, 150 coins) ───
  if (deliveryType === DeliveryType.PIGEON) {
    const { senderLat, senderLng, destLat, destLng, destAddress } = body;

    if (senderLat == null || senderLng == null || destLat == null || destLng == null || !destAddress) {
      return NextResponse.json(
        { error: 'senderLat, senderLng, destLat, destLng, destAddress required for Pigeon.' },
        { status: 400 },
      );
    }

    const distanceKm = haversineDistanceKm(senderLat, senderLng, destLat, destLng);
    const { finalDurationSec, isDelayed, pigeonNote } = calculatePigeonFlight(distanceKm);
    const deliverAt = new Date(now.getTime() + finalDurationSec * 1000);

    const pigeonData = {
      senderLat, senderLng, destLat, destLng, destAddress,
      distanceKm,
      flightDurationSec: finalDurationSec,
      survivalRate: 1.0,
    };

    // Deduct 150 coins upfront
    const [letter] = await prisma.$transaction([
      prisma.letter.create({
        data: {
          ...baseLetterData,
          ...pigeonData,
          deliveryType: DeliveryType.PIGEON,
          status: LetterStatus.IN_FLIGHT,
          deliverAt,
          pigeonSurvived: true,
          pigeonNote,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pigeonCoins: { decrement: cost } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          amount: -cost,
          type: txnType.PIGEON,
          description: `Pigeon delivery: -${cost} PigeonCoins → ${destAddress}`,
        },
      }),
    ]);

    return NextResponse.json(
      {
        letter,
        cost,
        distanceKm,
        flightDurationSec: finalDurationSec,
        isDelayed,
        pigeonNote,
        message: isDelayed
          ? `Pigeon dispatched! Weather headwinds detected (ETA: ${formatDuration(finalDurationSec)}).`
          : `Pigeon dispatched! Smooth skies ahead (ETA: ${formatDuration(finalDurationSec)}).`,
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ error: 'Unknown delivery type.' }, { status: 400 });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  const hours = seconds / 3600;
  if (hours < 24) {
    return `${hours.toFixed(1)} hours`;
  }
  const days = (hours / 24).toFixed(1);
  return `${days} days`;
}
