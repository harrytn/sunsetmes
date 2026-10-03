/**
 * app/api/users/public-key/route.ts
 *
 * GET  /api/users/public-key?userId=<id>
 *   Returns the public key JWK string for any user by ID.
 *   Used by the compose client to encrypt the letter key for the recipient.
 *
 * POST /api/users/public-key
 *   Body: { publicKey: string }  (JWK JSON string)
 *   Saves or updates the active user's RSA public key in the database.
 *   Called automatically by CryptoProvider on first launch or after key import.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveUserId } from '@/lib/session';
import prisma from '@/lib/prisma';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const requestingUserId = await getActiveUserId();
  if (!requestingUserId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') ?? requestingUserId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, publicKey: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (!user.publicKey) {
    return NextResponse.json(
      { error: 'This user has not yet initialised their encryption keys. They need to open the app first.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ publicKey: user.publicKey });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = await getActiveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { publicKey, replace } = (await req.json()) as { publicKey?: string; replace?: boolean };

  if (!publicKey || typeof publicKey !== 'string') {
    return NextResponse.json({ error: 'publicKey (JWK string) is required.' }, { status: 400 });
  }

  // Basic JWK validation — must parse as JSON with at least a "kty" field
  try {
    const parsed = JSON.parse(publicKey) as Record<string, unknown>;
    if (parsed.kty !== 'RSA') {
      throw new Error('Not an RSA key');
    }
  } catch {
    return NextResponse.json({ error: 'publicKey is not a valid RSA JWK.' }, { status: 400 });
  }

  const changed = await prisma.user.updateMany({
    where: replace ? { id: userId } : { id: userId, publicKey: null },
    data: { publicKey },
  });

  if (!changed.count) {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { publicKey: true } });
    const sameKey = current?.publicKey && (() => {
      const a = JSON.parse(current.publicKey!) as JsonWebKey;
      const b = JSON.parse(publicKey) as JsonWebKey;
      return a.n === b.n && a.e === b.e;
    })();
    if (!sameKey) return NextResponse.json({ error: 'A different public key is already registered.' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
