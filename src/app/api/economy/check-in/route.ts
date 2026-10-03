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

  const today = todayUtcMidnight();
  const result = await prisma.$transaction(async (tx) => {
    const update = await tx.user.updateMany({
      where: { id: userId, OR: [{ lastCheckIn: null }, { lastCheckIn: { lt: today } }] },
      data: {
        pigeonCoins: { increment: CHECKIN_AMOUNT },
        lastCheckIn: new Date(),
      },
    });
    if (update.count) {
      await tx.transaction.create({ data: {
        userId,
        amount: CHECKIN_AMOUNT,
        type: TransactionType.DAILY_CHECKIN,
        description: `Daily check-in: +${CHECKIN_AMOUNT} PigeonCoins`,
      } });
    }
    const user = await tx.user.findUnique({ where: { id: userId }, select: { pigeonCoins: true } });
    return { granted: update.count > 0, pigeonCoins: user?.pigeonCoins };
  });

  if (result.pigeonCoins == null) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    alreadyCheckedIn: !result.granted,
    granted: result.granted ? CHECKIN_AMOUNT : 0,
    pigeonCoins: result.pigeonCoins,
    message: result.granted ? `You received ${CHECKIN_AMOUNT} PigeonCoins today.` : undefined,
  });
}
