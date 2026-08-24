/**
 * GET /api/questions/history
 *
 * Returns all past DailyQuestion records where BOTH users have submitted
 * an Answer (i.e. answers.length >= 2 or at least 1 answered and date has passed).
 * Ordered by question date descending.
 */

import { NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch all completed questions with their answers and user details
  const questions = await prisma.dailyQuestion.findMany({
    where: {
      answers: {
        some: {}, // has at least one answer
      },
    },
    include: {
      answers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarColor: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Filter to questions where both users have answered
  const completedQuestions = questions.filter((q) => q.answers.length >= 2);

  return NextResponse.json({
    history: completedQuestions.map((q) => ({
      id: q.id,
      date: q.date,
      text: q.text,
      answers: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
        grade: a.grade,
        user: {
          id: a.user.id,
          name: a.user.name,
          avatarColor: a.user.avatarColor,
        },
        createdAt: a.createdAt,
      })),
    })),
  });
}
