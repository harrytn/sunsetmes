/**
 * POST /api/economy/check-in
 *
 * Daily check-in: awards 50 PigeonCoins the first time a user opens the app
 * each calendar day (UTC). Uses User.lastCheckIn for fast idempotency checks.
 */

import { NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

const CHECKIN_AMOUNT = 50;

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST() {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastCheckIn: true, pigeonCoins: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const today = todayUtcMidnight();

  // Already checked in today?
  if (user.lastCheckIn && user.lastCheckIn >= today) {
    return NextResponse.json({
      alreadyCheckedIn: true,
      pigeonCoins: user.pigeonCoins,
    });
  }

  // Grant daily check-in
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        pigeonCoins: { increment: CHECKIN_AMOUNT },
        lastCheckIn: new Date(),
      },
      select: { id: true, pigeonCoins: true },
    }),
    prisma.transaction.create({
      data: {
        userId,
        amount: CHECKIN_AMOUNT,
        type: TransactionType.DAILY_CHECKIN,
        description: `Daily check-in: +${CHECKIN_AMOUNT} PigeonCoins ☀️`,
      },
    }),
  ]);

  return NextResponse.json({
    alreadyCheckedIn: false,
    granted: CHECKIN_AMOUNT,
    pigeonCoins: updated.pigeonCoins,
    message: `+${CHECKIN_AMOUNT} PigeonCoins! Welcome back ☀️`,
  });
}
