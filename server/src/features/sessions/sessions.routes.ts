import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './sessions.controller';

/** Active-session management, mounted at /api/v1/sessions. All require auth. */
export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

sessionsRouter.get('/', asyncHandler(controller.listSessions));

// Revoke all sessions except the caller's current one ("log out everywhere else").
sessionsRouter.delete('/', asyncHandler(controller.revokeOtherSessions));

// Revoke a specific session.
sessionsRouter.delete('/:id', asyncHandler(controller.revokeSession));
