/**
 * lib/session.ts
 * HTTP-only cookie-based active user session helpers.
 * Used by the user switcher so that the active user persists when launched
 * from the iOS home screen (PWA standalone mode).
 */

import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const SESSION_COOKIE = 'sm_active_user';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Read the active user ID from the HTTP-only session cookie.
 * Returns null if no cookie is set.
 */
export async function getActiveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
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
  cookieStore.set(SESSION_COOKIE, userId, {
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
