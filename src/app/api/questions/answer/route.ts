/**
 * POST /api/questions/answer
 * Body: { questionId: string, text: string }
 *
 * Submit an answer to today's daily question.
 * Each user can only answer once per question (@@unique constraint).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { questionId, text } = (await req.json()) as {
    questionId?: string;
    text?: string;
  };

  if (!questionId || !text?.trim()) {
    return NextResponse.json(
      { error: 'questionId and text are required.' },
      { status: 400 },
    );
  }

  // Verify the question exists
  const question = await prisma.dailyQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  // Check if user already answered
  const existing = await prisma.answer.findUnique({
    where: { questionId_userId: { questionId, userId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'You have already answered this question.' },
      { status: 409 },
    );
  }

  const answer = await prisma.answer.create({
    data: {
      questionId,
      userId,
      text: text.trim(),
    },
    select: { id: true, text: true, createdAt: true },
  });

  return NextResponse.json({ answer }, { status: 201 });
}
