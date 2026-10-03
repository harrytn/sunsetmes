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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url: string;            // Deep link opened on notification tap
  tag?: string;           // Deduplication tag (default: 'sunset-messages')
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
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('Push notifications need all three VAPID environment variables.');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subs.length === 0) return 0;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? 'sunset-messages',
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
        if (statusCode !== 404 && statusCode !== 410) {
          console.error('Push delivery failed', { statusCode });
        }
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
