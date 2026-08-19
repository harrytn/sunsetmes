/**
 * GET /api/questions/today
 *
 * Returns today's daily question and the active user's answer state.
 * State machine: unanswered → waiting → grading → rewarded
 */

import { NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getOrCreateTodayQuestion } from '@/lib/daily-question';

export async function GET() {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const question = await getOrCreateTodayQuestion();

  // Find this user's answer and the partner's answer
  const myAnswer = question.answers.find((a) => a.userId === userId) ?? null;
  const partnerAnswer = question.answers.find((a) => a.userId !== userId) ?? null;

  // Determine state
  let state: 'unanswered' | 'waiting' | 'grading' | 'rewarded';

  if (!myAnswer) {
    state = 'unanswered';
  } else if (!partnerAnswer) {
    state = 'waiting';
  } else if (partnerAnswer.grade == null) {
    // Both answered, but I haven't graded the partner's answer yet
    state = 'grading';
  } else {
    state = 'rewarded';
  }

  // Fetch partner info for display
  const partner = await prisma.user.findFirst({
    where: { id: { not: userId } },
    select: { id: true, name: true, avatarColor: true },
  });

  return NextResponse.json({
    question: {
      id: question.id,
      text: question.text,
      date: question.date,
    },
    myAnswer: myAnswer
      ? { id: myAnswer.id, text: myAnswer.text }
      : null,
    partnerAnswer:
      state === 'grading' || state === 'rewarded'
        ? {
            id: partnerAnswer!.id,
            text: partnerAnswer!.text,
            grade: partnerAnswer!.grade,
            userId: partnerAnswer!.userId,
          }
        : null,
    state,
    partner: partner
      ? { id: partner.id, name: partner.name, avatarColor: partner.avatarColor }
      : null,
  });
}
