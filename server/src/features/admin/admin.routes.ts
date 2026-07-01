import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ipBlocking from '../ip-blocking/ipBlocking.controller';
import { blockIpSchema } from '../ip-blocking/ipBlocking.schema';
import * as controller from './admin.controller';
import * as dashboard from './adminDashboard.controller';
import {
  createRoleSchema,
  setRolePermissionsSchema,
  setUserActiveSchema,
  setUserRolesSchema,
  updateRoleSchema,
} from './admin.schema';

/** Administrative dashboard + RBAC management, mounted at /api/v1/admin. */
export const adminRouter = Router();

adminRouter.use(requireAuth);

// Dashboard
adminRouter.get('/stats', requirePermission('users:read'), asyncHandler(dashboard.stats));
adminRouter.get('/users', requirePermission('users:read'), asyncHandler(dashboard.listUsers));
adminRouter.get('/users/:id', requirePermission('users:read'), asyncHandler(dashboard.getUser));
adminRouter.patch(
  '/users/:id/status',
  requirePermission('users:manage'),
  validateBody(setUserActiveSchema),
  asyncHandler(dashboard.setUserActive),
);
adminRouter.post('/users/:id/unlock', requirePermission('users:manage'), asyncHandler(dashboard.unlock));
adminRouter.get(
  '/audit-logs',
  requirePermission('audit_logs:read'),
  asyncHandler(dashboard.listAuditLogs),
);
adminRouter.get(
  '/organizations',
  requirePermission('organizations:manage'),
  asyncHandler(dashboard.listOrganizations),
);

// IP blocking
adminRouter.get('/blocked-ips', requirePermission('ip_blocks:read'), asyncHandler(ipBlocking.list));
adminRouter.post(
  '/blocked-ips',
  requirePermission('ip_blocks:manage'),
  validateBody(blockIpSchema),
  asyncHandler(ipBlocking.block),
);
adminRouter.delete(
  '/blocked-ips/:id',
  requirePermission('ip_blocks:manage'),
  asyncHandler(ipBlocking.unblock),
);

adminRouter.get('/permissions', requirePermission('permissions:read'), asyncHandler(controller.listPermissions));

adminRouter.get('/roles', requirePermission('roles:read'), asyncHandler(controller.listRoles));
adminRouter.post(
  '/roles',
  requirePermission('roles:manage'),
  validateBody(createRoleSchema),
  asyncHandler(controller.createRole),
);
adminRouter.patch(
  '/roles/:id',
  requirePermission('roles:manage'),
  validateBody(updateRoleSchema),
  asyncHandler(controller.updateRole),
);
adminRouter.delete('/roles/:id', requirePermission('roles:manage'), asyncHandler(controller.deleteRole));
adminRouter.put(
  '/roles/:id/permissions',
  requirePermission('roles:manage'),
  validateBody(setRolePermissionsSchema),
  asyncHandler(controller.setRolePermissions),
);

adminRouter.put(
  '/users/:id/roles',
  requirePermission('users:manage'),
  validateBody(setUserRolesSchema),
  asyncHandler(controller.setUserRoles),
);
