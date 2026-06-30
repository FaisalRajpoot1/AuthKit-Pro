import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './oauth.controller';

/** OAuth sign-in and account linking, mounted at /api/v1/auth/oauth. */
export const oauthRouter = Router();

// Authenticated: manage linked accounts.
oauthRouter.get('/accounts', requireAuth, asyncHandler(controller.listAccounts));
oauthRouter.get('/:provider/link', requireAuth, controller.getLinkUrl);
oauthRouter.delete('/:provider', requireAuth, asyncHandler(controller.unlink));

// Public: begin sign-in and handle the provider redirect.
oauthRouter.get('/:provider/url', authRateLimiter, controller.getLoginUrl);
oauthRouter.get('/:provider/callback', asyncHandler(controller.callback));
