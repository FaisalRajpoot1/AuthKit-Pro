import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './passwordReset.controller';
import { forgotPasswordSchema, resetPasswordSchema } from './passwordReset.schema';

/** Password reset flow, mounted at /api/v1/auth/password. */
export const passwordResetRouter = Router();

passwordResetRouter.post(
  '/forgot',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(controller.forgotPassword),
);

passwordResetRouter.post(
  '/reset',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
