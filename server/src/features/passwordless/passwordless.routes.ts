import { Router } from 'express';
import { verifyCaptcha } from '../../middleware/captcha.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './passwordless.controller';
import { magicVerifySchema, otpVerifySchema, passwordlessRequestSchema } from './passwordless.schema';

/** Passwordless login (magic link + email OTP), mounted at /auth/passwordless. */
export const passwordlessRouter = Router();

passwordlessRouter.post(
  '/magic-link/request',
  authRateLimiter,
  verifyCaptcha,
  validateBody(passwordlessRequestSchema),
  asyncHandler(controller.requestMagicLink),
);
passwordlessRouter.post(
  '/magic-link/verify',
  authRateLimiter,
  validateBody(magicVerifySchema),
  asyncHandler(controller.verifyMagicLink),
);
passwordlessRouter.post(
  '/otp/request',
  authRateLimiter,
  verifyCaptcha,
  validateBody(passwordlessRequestSchema),
  asyncHandler(controller.requestOtp),
);
passwordlessRouter.post(
  '/otp/verify',
  authRateLimiter,
  validateBody(otpVerifySchema),
  asyncHandler(controller.verifyOtp),
);
