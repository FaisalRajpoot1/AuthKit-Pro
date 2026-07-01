import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './notifications.controller';

/** In-app notifications, mounted at /api/v1/notifications. All require auth. */
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', asyncHandler(controller.list));
notificationsRouter.get('/unread-count', asyncHandler(controller.unreadCount));
notificationsRouter.post('/read-all', asyncHandler(controller.markAllRead));
notificationsRouter.post('/:id/read', asyncHandler(controller.markRead));
notificationsRouter.delete('/:id', asyncHandler(controller.remove));
