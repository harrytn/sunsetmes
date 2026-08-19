/**
 * app/api/notifications/subscribe/route.ts
 *
 * POST /api/notifications/subscribe
 *   Body: { endpoint, keys: { p256dh, auth } }
 *   Upserts the push subscription for the active user.
 *
 * DELETE /api/notifications/subscribe
 *   Body: { endpoint }
 *   Removes the subscription from the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: 'endpoint, keys.p256dh and keys.auth are required.' },
      { status: 400 },
    );
  }

  // Upsert — same endpoint may be re-registered after browser restart
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { endpoint } = (await req.json()) as { endpoint?: string };

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required.' }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId }, // guard: only delete own subscriptions
  });

  return NextResponse.json({ ok: true });
}
