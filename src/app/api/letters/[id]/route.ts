/**
 * app/api/letters/[id]/route.ts
 * GET   /api/letters/[id]  → single letter with server-side delivery lock
 * PATCH /api/letters/[id]  → mark as opened
 *
 * E2EE lock: strips encryptedContent + encryptedKeyRecipient while locked.
 * RETURNED letters: visible to sender (who can decrypt via encryptedKeySender).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      sender:    { select: { id: true, name: true, avatarColor: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!letter) {
    return NextResponse.json({ error: 'Letter not found.' }, { status: 404 });
  }

  if (letter.senderId !== userId && letter.recipientId !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // RETURNED letters: only the sender can view
  if (letter.status === 'RETURNED' && letter.recipientId === userId) {
    return NextResponse.json({ error: 'This letter was returned to sender.' }, { status: 403 });
  }

  const now = new Date();
  const isDelivered = letter.deliverAt <= now;
  const isRecipient = letter.recipientId === userId;

  // Server-side payload lock: strip content while in-flight for recipient
  if (!isDelivered && isRecipient) {
    const {
      encryptedContent: _ec,
      encryptedKeyRecipient: _ekr,
      ...meta
    } = letter;
    void _ec; void _ekr;
    return NextResponse.json({
      ...meta,
      locked: true,
      encryptedContent: null,
      encryptedKeyRecipient: null,
    });
  }

  return NextResponse.json({ ...letter, locked: false });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const { action } = (await req.json()) as { action?: string };

  if (action !== 'open') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const letter = await prisma.letter.findUnique({ where: { id } });
  if (!letter) {
    return NextResponse.json({ error: 'Letter not found.' }, { status: 404 });
  }

  if (letter.recipientId !== userId) {
    return NextResponse.json({ error: 'Only the recipient can open a letter.' }, { status: 403 });
  }

  const now = new Date();
  if (letter.deliverAt > now) {
    return NextResponse.json({ error: 'Letter has not arrived yet.' }, { status: 403 });
  }

  const updated = await prisma.letter.update({
    where: { id },
    data: {
      openedAt: letter.openedAt ?? now,
      status: 'DELIVERED',
    },
    select: { id: true, openedAt: true, status: true },
  });

  return NextResponse.json(updated);
}
