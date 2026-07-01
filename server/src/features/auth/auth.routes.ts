import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { verifyCaptcha } from '../../middleware/captcha.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { emailVerificationRouter } from '../email-verification/emailVerification.routes';
import { oauthRouter } from '../oauth/oauth.routes';
import { passkeysAuthRouter } from '../passkeys/passkeys.routes';
import { passwordResetRouter } from '../password-reset/passwordReset.routes';
import { passwordlessRouter } from '../passwordless/passwordless.routes';
import * as authController from './auth.controller';
import {
  loginSchema,
  registerSchema,
  twoFactorEmailOtpSchema,
  twoFactorLoginSchema,
} from './auth.schema';

/**
 * Auth routes mounted at /api/v1/auth. Sensitive endpoints are rate-limited;
 * request bodies are validated before reaching controllers.
 */
export const authRouter = Router();

// Sub-flows: /auth/email/*, /auth/password/*, /auth/oauth/*
authRouter.use('/email', emailVerificationRouter);
authRouter.use('/password', passwordResetRouter);
authRouter.use('/oauth', oauthRouter);
authRouter.use('/passwordless', passwordlessRouter);
authRouter.use('/passkeys', passkeysAuthRouter);

authRouter.post(
  '/register',
  authRateLimiter,
  verifyCaptcha,
  validateBody(registerSchema),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  authRateLimiter,
  verifyCaptcha,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post(
  '/2fa/email-otp/request',
  authRateLimiter,
  validateBody(twoFactorEmailOtpSchema),
  asyncHandler(authController.twoFactorEmailOtp),
);

authRouter.post(
  '/2fa/login',
  authRateLimiter,
  validateBody(twoFactorLoginSchema),
  asyncHandler(authController.twoFactorLogin),
);

authRouter.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));

authRouter.post('/logout', asyncHandler(authController.logout));

authRouter.get('/me', requireAuth, asyncHandler(authController.me));
