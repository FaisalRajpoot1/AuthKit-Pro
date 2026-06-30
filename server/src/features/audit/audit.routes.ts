import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './audit.controller';

/** Read-only access to the caller's own audit history, at /api/v1/audit-logs. */
export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get('/', asyncHandler(controller.listMyAuditLogs));
