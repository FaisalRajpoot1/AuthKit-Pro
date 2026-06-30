import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as authController from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

/**
 * Auth routes mounted at /api/v1/auth. Sensitive endpoints are rate-limited;
 * request bodies are validated before reaching controllers.
 */
export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));

authRouter.post('/logout', asyncHandler(authController.logout));

authRouter.get('/me', requireAuth, asyncHandler(authController.me));
