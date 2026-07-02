import webpush from 'web-push';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

/** A browser PushSubscription as sent by the client. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let configured = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

/** Whether Web Push is configured (VAPID keys present). */
export function isPushConfigured(): boolean {
  return configured;
}

/** The VAPID public key the client needs to subscribe, or null when disabled. */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

/** Stores (or refreshes) a device's push subscription for the user. */
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/** Removes a device's push subscription by endpoint. */
export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a Web Push to all of a user's subscribed devices. No-op when VAPID isn't
 * configured. Best-effort: failures are logged, and subscriptions the push
 * service reports as gone (404/410) are pruned. Never throws.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            logger.warn({ err, userId }, 'Web push delivery failed');
          }
        }
      }),
    );
  } catch (error) {
    logger.error({ err: error, userId }, 'sendPushToUser failed');
  }
}
