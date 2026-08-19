/**
 * app/api/users/route.ts
 * GET /api/users
 *
 * Returns all seeded users (id, name, email, avatarColor, pigeonCoins).
 * Used by the user-switcher component to list available profiles.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
      pigeonCoins: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ users });
}
