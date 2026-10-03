import { NextRequest, NextResponse } from 'next/server';
import { LetterStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push';

// Vercel calls this GET once daily, near 22:00 in Lagos (21:00 UTC).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const lagosNow = new Date(now.getTime() + 60 * 60 * 1000);
  const dayStart = new Date(Date.UTC(
    lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate(), -1,
  ));

  // A late cron never keeps a letter locked; the UI also checks deliverAt.
  const delivered = await prisma.letter.updateMany({
    where: { status: LetterStatus.IN_FLIGHT, deliverAt: { lte: now } },
    data: { status: LetterStatus.DELIVERED },
  });

  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: { id: true, lastCheckIn: true },
  });
  let reminders = 0;
  let dispatched = 0;

  for (const user of users) {
    const inactiveToday = !user.lastCheckIn || user.lastCheckIn < dayStart;
    const unreadSinceVisit = !inactiveToday && await prisma.letter.findFirst({
      where: {
        recipientId: user.id,
        status: LetterStatus.DELIVERED,
        openedAt: null,
        deliverAt: { gt: user.lastCheckIn!, lte: now },
      },
      select: { id: true },
    });
    if (!inactiveToday && !unreadSinceVisit) continue;

    // Repeated cron invocations cannot create multiple alerts per profile.
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: dayStart } }],
      },
      data: { lastReminderAt: now },
    });
    if (!claimed.count) continue;

    reminders++;
    try {
      dispatched += await sendPushNotification(user.id, {
        title: 'Sunset Messages',
        body: inactiveToday ? 'Check on your inbox.' : 'You have an unread message. Check your inbox.',
        url: '/',
        tag: `daily-inbox-${user.id}`,
      });
    } catch (error) {
      console.error('Daily inbox notification failed', error);
    }
  }

  return NextResponse.json({ delivered: delivered.count, reminders, dispatched });
}
