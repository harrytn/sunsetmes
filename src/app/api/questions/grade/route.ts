/**
 * POST /api/questions/grade
 * Body: { answerId: string, grade: number }
 *
 * Grade the partner's answer (0–5 stars).
 * Only the partner (NOT the answer's author) can grade.
 * Credits the answer author: grade × 10 PigeonCoins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { answerId, grade } = (await req.json()) as {
    answerId?: string;
    grade?: number;
  };

  if (!answerId || grade == null || grade < 0 || grade > 5 || !Number.isInteger(grade)) {
    return NextResponse.json(
      { error: 'answerId and grade (integer 0–5) are required.' },
      { status: 400 },
    );
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!answer) {
    return NextResponse.json({ error: 'Answer not found.' }, { status: 404 });
  }

  // Only the partner (not the author) can grade
  if (answer.userId === userId) {
    return NextResponse.json(
      { error: 'You cannot grade your own answer.' },
      { status: 403 },
    );
  }

  // Already graded?
  if (answer.grade != null) {
    return NextResponse.json(
      { error: 'This answer has already been graded.' },
      { status: 409 },
    );
  }

  const reward = grade * 10;

  // Update grade + credit partner in a transaction
  await prisma.$transaction([
    prisma.answer.update({
      where: { id: answerId },
      data: { grade },
    }),
    ...(reward > 0
      ? [
          prisma.user.update({
            where: { id: answer.userId },
            data: { pigeonCoins: { increment: reward } },
          }),
          prisma.transaction.create({
            data: {
              userId: answer.userId,
              amount: reward,
              type: TransactionType.QUESTION_REWARD,
              description: `Daily question: ${answer.user.name} earned ${reward} coins (${grade}★ rating)`,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    grade,
    reward,
    partnerId: answer.userId,
    partnerName: answer.user.name,
    message: reward > 0
      ? `${answer.user.name} earned ${reward} PigeonCoins!`
      : `Rated ${grade}★ — no coins awarded.`,
  });
}
