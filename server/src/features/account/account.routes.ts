import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { twoFactorRouter } from '../two-factor/twoFactor.routes';
import * as controller from './account.controller';
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from './account.schema';

/** Account/profile self-management, mounted at /api/v1/account. */
export const accountRouter = Router();

// Public: pre-registration availability check.
accountRouter.get('/availability', asyncHandler(controller.checkAvailability));

// Two-factor management (the sub-router applies its own auth guard).
accountRouter.use('/2fa', twoFactorRouter);

// Everything below requires authentication.
accountRouter.use(requireAuth);

accountRouter.patch(
  '/profile',
  validateBody(updateProfileSchema),
  asyncHandler(controller.updateProfile),
);

accountRouter.post(
  '/change-password',
  authRateLimiter,
  validateBody(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

accountRouter.post(
  '/change-email',
  authRateLimiter,
  validateBody(changeEmailSchema),
  asyncHandler(controller.changeEmail),
);

accountRouter.delete('/', validateBody(deleteAccountSchema), asyncHandler(controller.deleteAccount));
