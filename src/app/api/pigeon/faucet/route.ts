/**
 * app/api/pigeon/faucet/route.ts
 * POST /api/pigeon/faucet
 *
 * Daily PigeonCoin refill. Grants 25 coins if the user hasn't received a
 * refill in the last 24 hours.
 */

import { NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

const FAUCET_AMOUNT = 25;
const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const lastRefill = await prisma.transaction.findFirst({
    where: { userId, type: TransactionType.FAUCET_REFILL },
    orderBy: { createdAt: 'desc' },
  });

  if (lastRefill) {
    const elapsed = Date.now() - lastRefill.createdAt.getTime();
    if (elapsed < FAUCET_COOLDOWN_MS) {
      const nextRefillMs = FAUCET_COOLDOWN_MS - elapsed;
      const nextRefillHours = Math.ceil(nextRefillMs / 3600000);
      return NextResponse.json(
        {
          error: `Faucet already used. Next refill available in ~${nextRefillHours}h.`,
          nextRefillMs,
        },
        { status: 429 },
      );
    }
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { pigeonCoins: { increment: FAUCET_AMOUNT } },
      select: { id: true, name: true, pigeonCoins: true },
    }),
    prisma.transaction.create({
      data: {
        userId,
        amount: FAUCET_AMOUNT,
        type: TransactionType.FAUCET_REFILL,
        description: `Daily faucet: +${FAUCET_AMOUNT} PigeonCoins 🐦`,
      },
    }),
  ]);

  return NextResponse.json({
    user,
    granted: FAUCET_AMOUNT,
    message: `${FAUCET_AMOUNT} PigeonCoins added! 🐦`,
  });
}
