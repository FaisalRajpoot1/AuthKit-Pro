import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './notifications.service';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

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
