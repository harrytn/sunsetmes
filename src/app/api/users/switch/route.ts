/**
 * app/api/users/switch/route.ts
 * POST /api/users/switch
 * Body: { userId: string, passcode: string }
 *
 * Sets the active user session cookie (HTTP-only).
 * The frontend uses this to sign in to Sun or Moon.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setActiveUserCookie } from '@/lib/session';
import prisma from '@/lib/prisma';
import { profilePasscodeMatches, SignInConfigurationError } from '@/lib/profile-passcode';

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

    if (!user || !profilePasscodeMatches(user.email, passcode)) {
      return NextResponse.json({ error: 'Incorrect profile or passcode.' }, { status: 401 });
    }

    await setActiveUserCookie(userId);

    return NextResponse.json({ user });
  } catch (cause) {
    if (cause instanceof SignInConfigurationError) {
      return NextResponse.json({ error: cause.message, code: cause.code }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
