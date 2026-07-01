import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './apiKeys.controller';
import { createApiKeySchema } from './apiKeys.schema';

/** API-key management, mounted at /api/v1/account/api-keys. Requires a session. */
export const apiKeysRouter = Router();

apiKeysRouter.use(requireAuth);

apiKeysRouter.get('/scopes', controller.listScopes);
apiKeysRouter.get('/', asyncHandler(controller.list));
apiKeysRouter.post(
  '/',
  authRateLimiter,
  validateBody(createApiKeySchema),
  asyncHandler(controller.create),
);
apiKeysRouter.delete('/:id', asyncHandler(controller.revoke));
