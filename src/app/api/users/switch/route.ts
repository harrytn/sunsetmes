/**
 * app/api/users/switch/route.ts
 * POST /api/users/switch
 * Body: { userId: string }
 *
 * Sets the active user session cookie (HTTP-only).
 * The frontend user-switcher calls this to toggle between Soleil & Marina.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setActiveUserCookie } from '@/lib/session';
import prisma from '@/lib/prisma';
import { createHmac, timingSafeEqual } from 'node:crypto';

function passcodeMatches(email: string, passcode: string): boolean {
  const expected = email === 'sun@sunset.local' ? process.env.SUN_PASSCODE
    : email === 'moon@sunset.local' ? process.env.MOON_PASSCODE : undefined;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) return false;
  const digest = (value: string) => createHmac('sha256', secret).update(value).digest();
  return timingSafeEqual(digest(passcode), digest(expected));
}

export async function POST(req: NextRequest) {
  try {
    const { userId, passcode } = (await req.json()) as { userId?: string; passcode?: string };

    if (!userId || typeof userId !== 'string' || typeof passcode !== 'string') {
      return NextResponse.json({ error: 'Profile and passcode are required.' }, { status: 400 });
    }

    // Verify the user actually exists before issuing the cookie
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarColor: true },
    });

    if (!user || !passcodeMatches(user.email, passcode)) {
      return NextResponse.json({ error: 'Incorrect profile or passcode.' }, { status: 401 });
    }

    await setActiveUserCookie(userId);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
