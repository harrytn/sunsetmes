import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { promptForUtcDate } from '@/data/daily-prompts';

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET() {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const date = todayUtc();
  const moods = await prisma.dailyMood.findMany({
    where: { date },
    select: { userId: true, word: true, user: { select: { name: true, avatarColor: true } } },
  });
  return NextResponse.json({ date, prompt: promptForUtcDate(date), moods }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let word: unknown;
  try { word = (await req.json()).word; } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof word !== 'string' || !/^\S{1,40}$/u.test(word.trim())) {
    return NextResponse.json({ error: 'Enter one word, up to 40 characters.' }, { status: 400 });
  }
  const date = todayUtc();
  const mood = await prisma.dailyMood.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, word: word.trim() },
    update: { word: word.trim() },
    select: { word: true },
  });
  return NextResponse.json({ mood });
}
