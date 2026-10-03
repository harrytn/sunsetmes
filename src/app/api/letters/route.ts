/**
 * app/api/letters/route.ts
 * GET  /api/letters  → list inbox + outbox
 * POST /api/letters  → send a readable letter
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
import { DeliveryType, LetterStatus, TransactionType, Prisma } from '@prisma/client';

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
    const now = Date.now();
    return NextResponse.json({ letters: letters.map((letter) => ({
      ...letter,
      status: letter.status === LetterStatus.IN_FLIGHT && letter.deliverAt.getTime() <= now
        ? LetterStatus.DELIVERED : letter.status,
    })) });
  }

  // Inbox: only DELIVERED letters (True Blind Delivery - hides in-flight letters)
  const letters = await prisma.letter.findMany({
    where: {
      recipientId: userId,
      OR: [{ status: LetterStatus.DELIVERED }, { status: LetterStatus.IN_FLIGHT, deliverAt: { lte: new Date() } }],
    },
    select: letterSelect,
    orderBy: { deliverAt: 'asc' },
  });
  return NextResponse.json({ letters: letters.map((letter) => ({
    ...letter,
    status: letter.status === LetterStatus.IN_FLIGHT ? LetterStatus.DELIVERED : letter.status,
  })) });
}

// ─── POST – Send a Letter ─────────────────────────────────────────────────────

export interface SendLetterBody {
  recipientId: string;
  title: string;
  paperStyle?: string;
  waxSealColor?: string;
  deliveryType: DeliveryType;

  content: string;
  addressFrom?: string;
  addressTo?: string;

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
    content, addressFrom, addressTo,
  } = body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!recipientId || !title?.trim() || !deliveryType) {
    return NextResponse.json(
      { error: 'recipientId, title, and deliveryType are required.' },
      { status: 400 },
    );
  }

  if (typeof content !== 'string' || !content.trim() || content.length > 50_000) {
    return NextResponse.json(
      { error: 'Enter a letter with up to 50,000 characters.' },
      { status: 400 },
    );
  }
  if (addressFrom != null && (typeof addressFrom !== 'string' || addressFrom.length > 100) ||
      addressTo != null && (typeof addressTo !== 'string' || addressTo.length > 100)) {
    return NextResponse.json({ error: 'Addresses must be 100 characters or fewer.' }, { status: 400 });
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
  if (cost === undefined) {
    return NextResponse.json({ error: 'Unknown delivery type.' }, { status: 400 });
  }
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
    content: content.trim(),
    addressFrom: addressFrom?.trim() || null,
    addressTo: addressTo?.trim() || null,
    paperStyle: paperStyle ?? 'classic-sand',
    waxSealColor: waxSealColor ?? '#1A8B9D',
  };

  const txnType: Record<DeliveryType, TransactionType> = {
    STANDARD: TransactionType.DELIVERY_STANDARD,
    EXPRESS: TransactionType.DELIVERY_EXPRESS,
    PIGEON: TransactionType.DELIVERY_PIGEON,
  };

  async function chargeAndCreate(data: Prisma.LetterUncheckedCreateInput, description: string) {
    return prisma.$transaction(async (tx) => {
      const charge = await tx.user.updateMany({
        where: { id: userId!, pigeonCoins: { gte: cost } },
        data: { pigeonCoins: { decrement: cost } },
      });
      if (!charge.count) return null;
      const letter = await tx.letter.create({ data });
      await tx.transaction.create({
        data: { userId: userId!, letterId: letter.id, amount: -cost, type: txnType[deliveryType], description },
      });
      return letter;
    });
  }

  // ── STANDARD (14 days, 50 coins) ──────────────────────────────────────────
  if (deliveryType === DeliveryType.STANDARD) {
    const deliverAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const letter = await chargeAndCreate({
      ...baseLetterData, deliveryType: DeliveryType.STANDARD,
      status: LetterStatus.IN_FLIGHT, deliverAt,
    }, `Standard delivery: -${cost} PigeonCoins`);
    if (!letter) return NextResponse.json({ error: 'Insufficient PigeonCoins.' }, { status: 402 });
    return NextResponse.json({ letter, cost, message: 'Standard letter dispatched!' }, { status: 201 });
  }

  // ── EXPRESS (7 days, 100 coins) ───────────────────────────────────────────
  if (deliveryType === DeliveryType.EXPRESS) {
    const deliverAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const letter = await chargeAndCreate({
      ...baseLetterData, deliveryType: DeliveryType.EXPRESS,
      status: LetterStatus.IN_FLIGHT, deliverAt,
    }, `Express delivery: -${cost} PigeonCoins`);
    if (!letter) return NextResponse.json({ error: 'Insufficient PigeonCoins.' }, { status: 402 });
    return NextResponse.json({ letter, cost, message: 'Express letter dispatched!' }, { status: 201 });
  }

  // ── PIGEON (distance-based on-time chance, otherwise 25% delay) ──────────
  if (deliveryType === DeliveryType.PIGEON) {
    const { senderLat, senderLng, destLat, destLng, destAddress } = body;

    if (senderLat == null || senderLng == null || destLat == null || destLng == null || !destAddress) {
      return NextResponse.json(
        { error: 'senderLat, senderLng, destLat, destLng, destAddress required for Pigeon.' },
        { status: 400 },
      );
    }
    if (![senderLat, destLat].every((n) => Number.isFinite(n) && Math.abs(n) <= 90) ||
        ![senderLng, destLng].every((n) => Number.isFinite(n) && Math.abs(n) <= 180)) {
      return NextResponse.json({ error: 'Invalid route coordinates.' }, { status: 400 });
    }

    const distanceKm = haversineDistanceKm(senderLat, senderLng, destLat, destLng);
    const { finalDurationSec, isDelayed, pigeonNote, successRate } = calculatePigeonFlight(distanceKm);
    const deliverAt = new Date(now.getTime() + finalDurationSec * 1000);

    // Deduct 150 coins upfront
    const letter = await chargeAndCreate({
      ...baseLetterData, distanceKm, flightDurationSec: finalDurationSec,
      deliveryType: DeliveryType.PIGEON, status: LetterStatus.IN_FLIGHT,
      deliverAt, pigeonNote,
    }, `Pigeon delivery: -${cost} PigeonCoins`);
    if (!letter) return NextResponse.json({ error: 'Insufficient PigeonCoins.' }, { status: 402 });

    return NextResponse.json(
      {
        letter,
        cost,
        distanceKm,
        successRate,
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
