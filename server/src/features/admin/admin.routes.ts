import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './admin.controller';
import {
  createRoleSchema,
  setRolePermissionsSchema,
  setUserRolesSchema,
  updateRoleSchema,
} from './admin.schema';

/** Administrative RBAC management, mounted at /api/v1/admin. */
export const adminRouter = Router();

adminRouter.use(requireAuth);

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
