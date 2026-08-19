/**
 * src/lib/push.ts
 *
 * Web Push notification utility.
 * Initialises web-push with VAPID credentials and exports a helper that fans
 * out push notifications to every registered subscription for a given user.
 * Silently removes stale subscriptions that the push service rejects with 410.
 */

import webpush from 'web-push';
import prisma from '@/lib/prisma';

// ── VAPID initialisation ──────────────────────────────────────────────────────
// These are read at module load time. In local dev they come from .env;
// on Vercel they come from project environment variables.
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url: string;            // Deep link opened on notification tap
  tag?: string;           // Deduplication tag (default: 'sunset-messages')
  letterId?: string;      // Passed to the service worker for routing
}

// ── Main helper ───────────────────────────────────────────────────────────────

/**
 * Send a push notification to all registered subscriptions for `userId`.
 * Returns the number of notifications successfully dispatched.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subs.length === 0) return 0;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? 'sunset-messages',
    letterId: payload.letterId ?? null,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  });

  let dispatched = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          data,
          { TTL: 60 * 60 * 24 }, // 24-hour TTL
        );
        dispatched++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 / 410 = subscription no longer valid → prune it
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        }
        // Other errors (e.g. network) are silently ignored; the next attempt will retry
      }
    }),
  );

  // Prune expired subscriptions
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return dispatched;
}
