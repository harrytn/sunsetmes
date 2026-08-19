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

export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as { userId?: string };

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify the user actually exists before issuing the cookie
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarColor: true, pigeonCoins: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await setActiveUserCookie(userId);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
