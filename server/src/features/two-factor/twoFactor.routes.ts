import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './twoFactor.controller';
import {
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  regenerateBackupCodesSchema,
} from './twoFactor.schema';

/** Two-factor management, mounted at /api/v1/account/2fa. All require auth. */
export const twoFactorRouter = Router();

twoFactorRouter.use(requireAuth);

twoFactorRouter.get('/', asyncHandler(controller.status));
twoFactorRouter.post('/setup', authRateLimiter, asyncHandler(controller.setup));
twoFactorRouter.post(
  '/enable',
  authRateLimiter,
  validateBody(enableTwoFactorSchema),
  asyncHandler(controller.enable),
);
twoFactorRouter.post(
  '/disable',
  authRateLimiter,
  validateBody(disableTwoFactorSchema),
  asyncHandler(controller.disable),
);
twoFactorRouter.post(
  '/backup-codes',
  authRateLimiter,
  validateBody(regenerateBackupCodesSchema),
  asyncHandler(controller.regenerateBackupCodes),
);
