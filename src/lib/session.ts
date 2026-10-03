/**
 * lib/session.ts
 * HTTP-only cookie-based active user session helpers.
 * Used by the user switcher so that the active user persists when launched
 * from the iOS home screen (PWA standalone mode).
 */

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'sm_active_user';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function signature(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required.');
  return createHmac('sha256', secret).update(userId).digest('base64url');
}

/**
 * Read the active user ID from the HTTP-only session cookie.
 * Returns null if no cookie is set.
 */
export async function getActiveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const userId = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(signature(userId));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? userId : null;
}

/**
 * Fetch the full active User record from the database.
 * Returns null if not authenticated.
 */
export async function getActiveUser() {
  const userId = await getActiveUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
      pigeonCoins: true,
    },
  });
}

/**
 * Set the active user cookie (called from a Server Action or API route).
 * The cookie is:
 *   • httpOnly  – not readable by JavaScript (XSS protection)
 *   • secure    – only sent over HTTPS in production
 *   • sameSite  – "lax" allows iOS PWA standalone mode to keep the cookie
 *   • path "/"  – available across all routes
 */
export async function setActiveUserCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${userId}.${signature(userId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Clear the active user session.
 */
export async function clearActiveUserCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
