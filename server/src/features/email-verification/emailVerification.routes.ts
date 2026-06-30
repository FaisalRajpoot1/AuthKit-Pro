import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './emailVerification.controller';
import { consumeTokenSchema } from './emailVerification.schema';

/** Email verification + email-change confirmation, mounted at /api/v1/auth/email. */
export const emailVerificationRouter = Router();

emailVerificationRouter.post(
  '/verify',
  authRateLimiter,
  validateBody(consumeTokenSchema),
  asyncHandler(controller.verifyEmail),
);

emailVerificationRouter.post(
  '/confirm-change',
  authRateLimiter,
  validateBody(consumeTokenSchema),
  asyncHandler(controller.confirmEmailChange),
);

emailVerificationRouter.post(
  '/resend',
  requireAuth,
  authRateLimiter,
  asyncHandler(controller.resendVerification),
);
