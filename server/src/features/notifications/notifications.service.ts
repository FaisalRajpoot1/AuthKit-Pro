import type { NotificationType, Prisma } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { sendPushToUser } from './push.service';

const DEFAULT_PAGE = 20;
const MAX_PAGE = 100;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Prisma.JsonValue;
  read: boolean;
  createdAt: string;
}

function toDto(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    metadata: n.metadata,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Creates an in-app notification. Best-effort — a failure here must never break
 * the security action that triggered it.
 */
export async function notify(
  userId: string,
  input: { type: NotificationType; title: string; body: string; metadata?: Prisma.InputJsonValue },
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      },
    });
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to create notification');
  }

  // Fan out to the browser via Web Push (best-effort, no-op when unconfigured).
  await sendPushToUser(userId, { title: input.title, body: input.body });
}

export async function listNotifications(
  userId: string,
  options: { limit?: number | undefined; cursor?: string | undefined } = {},
): Promise<{ items: NotificationDto[]; nextCursor: string | null; unreadCount: number }> {
  const take = Math.min(options.limit ?? DEFAULT_PAGE, MAX_PAGE);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map(toDto),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    unreadCount,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
    if (!exists) throw new NotFoundError('Notification not found');
  }
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!notification) throw new NotFoundError('Notification not found');
  await prisma.notification.delete({ where: { id: notificationId } });
}
