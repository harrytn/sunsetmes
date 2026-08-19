/**
 * src/lib/daily-question.ts
 *
 * Server-side utility: getOrCreateTodayQuestion()
 *
 * 1. Compute today's UTC date (midnight).
 * 2. Check if a DailyQuestion already exists for that date → return it.
 * 3. Read questions.txt, query all previously used texts.
 * 4. Filter to the unused pool.
 * 5. Exhaustion fallback: if all questions have been asked, reset the cycle.
 * 6. Pick a random question, insert as today's DailyQuestion, return it.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '@/lib/prisma';

/** Get midnight UTC for today */
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Read all questions from the text file */
function loadQuestionPool(): string[] {
  const filePath = join(process.cwd(), 'src', 'data', 'questions.txt');
  const raw = readFileSync(filePath, 'utf-8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function getOrCreateTodayQuestion() {
  const today = todayUtcMidnight();

  // 1. Check if today's question already exists
  const existing = await prisma.dailyQuestion.findUnique({
    where: { date: today },
    include: {
      answers: {
        select: {
          id: true,
          userId: true,
          text: true,
          grade: true,
          createdAt: true,
        },
      },
    },
  });

  if (existing) return existing;

  // 2. Load the full pool from the text file
  const allQuestions = loadQuestionPool();

  // 3. Fetch all previously used question texts
  const usedQuestions = await prisma.dailyQuestion.findMany({
    select: { text: true },
  });
  const usedTexts = new Set(usedQuestions.map((q) => q.text));

  // 4. Filter to unused
  let availablePool = allQuestions.filter((q) => !usedTexts.has(q));

  // 5. Exhaustion fallback: if all have been asked, reset the cycle
  if (availablePool.length === 0) {
    availablePool = [...allQuestions];
  }

  // 6. Pick a random question
  const randomIndex = Math.floor(Math.random() * availablePool.length);
  const chosenText = availablePool[randomIndex];

  // Insert today's question
  const question = await prisma.dailyQuestion.create({
    data: {
      date: today,
      text: chosenText,
    },
    include: {
      answers: {
        select: {
          id: true,
          userId: true,
          text: true,
          grade: true,
          createdAt: true,
        },
      },
    },
  });

  return question;
}
