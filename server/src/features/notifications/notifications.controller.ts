import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './notifications.service';
import * as push from './push.service';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function list(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  res.status(200).json(await service.listNotifications(req.user!.id, query));
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  res.status(200).json({ unreadCount: await service.getUnreadCount(req.user!.id) });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  await service.markRead(req.user!.id, req.params.id as string);
  res.status(204).send();
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const count = await service.markAllRead(req.user!.id);
  res.status(200).json({ marked: count });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deleteNotification(req.user!.id, req.params.id as string);
  res.status(204).send();
}

export function pushPublicKey(_req: Request, res: Response): void {
  res.status(200).json({ publicKey: push.getVapidPublicKey(), enabled: push.isPushConfigured() });
}

export async function pushSubscribe(req: Request, res: Response): Promise<void> {
  const sub = subscribeSchema.parse(req.body);
  await push.saveSubscription(req.user!.id, sub);
  res.status(201).json({ message: 'Subscribed to push notifications' });
}

export async function pushUnsubscribe(req: Request, res: Response): Promise<void> {
  const { endpoint } = unsubscribeSchema.parse(req.body);
  await push.deleteSubscription(req.user!.id, endpoint);
  res.status(200).json({ message: 'Unsubscribed' });
}
