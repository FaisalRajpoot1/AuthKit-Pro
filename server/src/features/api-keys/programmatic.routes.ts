import { Router } from 'express';
import { apiKeyAuth, requireScope } from '../../middleware/apiKey.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { getProfile } from '../auth/auth.service';
import { listSessions } from '../sessions/sessions.service';

/**
 * Programmatic API, mounted at /api/v1/programmatic. Authenticated with an API
 * key (`X-API-Key` header) and gated per-endpoint by scope — demonstrating how
 * third-party integrations consume the API on a user's behalf.
 */
export const programmaticRouter = Router();

programmaticRouter.get(
  '/profile',
  apiKeyAuth,
  requireScope('profile:read'),
  asyncHandler(async (req, res) => {
    const user = await getProfile(req.apiAuth!.userId);
    res.status(200).json({ user });
  }),
);

programmaticRouter.get(
  '/sessions',
  apiKeyAuth,
  requireScope('sessions:read'),
  asyncHandler(async (req, res) => {
    // No originating session for a key, so nothing is flagged "current".
    const sessions = await listSessions(req.apiAuth!.userId, '');
    res.status(200).json({ sessions });
  }),
);
