import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './passkeys.controller';
import {
  authenticationOptionsSchema,
  authenticationVerifySchema,
  registrationVerifySchema,
} from './passkeys.schema';

/** Passkey management, mounted at /api/v1/account/passkeys (requires a session). */
export const passkeysRouter = Router();

passkeysRouter.use(requireAuth);
passkeysRouter.get('/', asyncHandler(controller.list));
passkeysRouter.post('/registration/options', authRateLimiter, asyncHandler(controller.registrationOptions));
passkeysRouter.post(
  '/registration/verify',
  authRateLimiter,
  validateBody(registrationVerifySchema),
  asyncHandler(controller.registrationVerify),
);
passkeysRouter.delete('/:id', asyncHandler(controller.remove));

/** Passkey sign-in, mounted at /api/v1/auth/passkeys (public). */
export const passkeysAuthRouter = Router();

passkeysAuthRouter.post(
  '/authentication/options',
  authRateLimiter,
  validateBody(authenticationOptionsSchema),
  asyncHandler(controller.authenticationOptions),
);
passkeysAuthRouter.post(
  '/authentication/verify',
  authRateLimiter,
  validateBody(authenticationVerifySchema),
  asyncHandler(controller.authenticationVerify),
);
