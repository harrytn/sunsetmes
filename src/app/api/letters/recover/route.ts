import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';
import { decodeLegacyLetter } from '@/lib/legacy-letter';

const BATCH_SIZE = 50;
const noStore = { 'Cache-Control': 'no-store' };

function accessibleLetters(userId: string): Prisma.LetterWhereInput {
  return { OR: [
    { senderId: userId },
    { recipientId: userId, OR: [
      { status: 'DELIVERED' },
      { status: 'IN_FLIGHT', deliverAt: { lte: new Date() } },
    ] },
  ] };
}

// Only wrapped per-letter keys are returned. Private keys remain in the browser.
export async function GET(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const after = req.nextUrl.searchParams.get('after');
  const letters = await prisma.letter.findMany({
    where: { AND: [accessibleLetters(userId), { content: null, encryptedContent: { not: null } }, ...(after ? [{ id: { gt: after } }] : [])] },
    select: { id: true, encryptedKeySender: true, encryptedKeyRecipient: true },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE + 1,
  });
  const page = letters.slice(0, BATCH_SIZE);
  return NextResponse.json({ letters: page, next: letters.length > BATCH_SIZE ? page.at(-1)!.id : null }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('recoveries' in body) || !Array.isArray(body.recoveries) || !body.recoveries.length || body.recoveries.length > BATCH_SIZE) {
    return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400 });
  }
  const recoveries = new Map<string, string>();
  for (const item of body.recoveries) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id.length > 128 || typeof item.aesKey !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(item.aesKey)) {
      return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400 });
    }
    recoveries.set(item.id, item.aesKey);
  }
  const letters = await prisma.letter.findMany({
    where: { AND: [accessibleLetters(userId), { id: { in: [...recoveries.keys()] } }] },
    select: { id: true, content: true, encryptedContent: true, iv: true, destAddress: true },
  });
  const restoredIds: string[] = [];
  for (const letter of letters) {
    if (letter.content !== null) { restoredIds.push(letter.id); continue; }
    if (!letter.encryptedContent || !letter.iv) continue;
    let restored;
    try {
      // Authenticate the original ciphertext. Clients cannot overwrite a letter with invented text.
      restored = decodeLegacyLetter(letter.encryptedContent, letter.iv, recoveries.get(letter.id)!);
    } catch { continue; }
    await prisma.letter.updateMany({
      where: { id: letter.id, content: null, encryptedContent: letter.encryptedContent },
      data: {
        content: restored.content, addressFrom: restored.addressFrom, addressTo: restored.addressTo,
        destAddress: letter.destAddress ?? restored.pigeonDestination,
      },
    });
    // Preserve ciphertext and never mark a letter read during recovery.
    restoredIds.push(letter.id);
  }
  return NextResponse.json({ restoredIds }, { headers: noStore });
}
