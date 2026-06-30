import { AuditAction } from '@prisma/client';
import { z } from 'zod';

const roleNameSchema = z
  .string()
  .min(2, 'Role name must be at least 2 characters')
  .max(30, 'Role name must be at most 30 characters')
  .regex(/^[a-z0-9_-]+$/, 'Role name may only contain lowercase letters, numbers, _ and -');

export const createRoleSchema = z.object({
  name: roleNameSchema,
  description: z.string().max(200).trim().optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export const updateRoleSchema = z.object({
  description: z.string().max(200).trim().nullable().optional(),
});

export const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});

export const setUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export const adminListQuerySchema = z.object({
  search: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

export const adminAuditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;
