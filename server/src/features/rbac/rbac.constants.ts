/**
 * Canonical RBAC definitions. The seed script and the application both import
 * these, so the permission matrix has a single source of truth.
 *
 * A permission is `resource:action`. Roles grant sets of permissions; `'*'`
 * means every permission (admin).
 */
export interface PermissionDef {
  resource: string;
  action: string;
  description: string;
}

export const PERMISSIONS: readonly PermissionDef[] = [
  { resource: 'users', action: 'read', description: 'View user accounts' },
  { resource: 'users', action: 'manage', description: 'Create, update, delete users and assign roles' },
  { resource: 'roles', action: 'read', description: 'View roles' },
  { resource: 'roles', action: 'manage', description: 'Create, update, delete roles and set permissions' },
  { resource: 'permissions', action: 'read', description: 'View available permissions' },
  { resource: 'audit_logs', action: 'read', description: 'View all users’ audit logs' },
  { resource: 'settings', action: 'manage', description: 'Manage application settings' },
  { resource: 'organizations', action: 'manage', description: 'Administer organizations' },
];

export function permissionKey(p: Pick<PermissionDef, 'resource' | 'action'>): string {
  return `${p.resource}:${p.action}`;
}

export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSIONS.map(permissionKey);

export interface RoleDef {
  name: string;
  description: string;
  /** Permission keys, or '*' for all. */
  permissions: readonly string[] | '*';
}

export const SYSTEM_ROLES: readonly RoleDef[] = [
  { name: 'admin', description: 'Full administrative access', permissions: '*' },
  {
    name: 'moderator',
    description: 'Moderates users and reviews activity',
    permissions: ['users:read', 'users:manage', 'audit_logs:read', 'roles:read', 'permissions:read'],
  },
  {
    name: 'manager',
    description: 'Read access across administrative areas',
    permissions: ['users:read', 'roles:read', 'audit_logs:read', 'permissions:read'],
  },
  { name: 'editor', description: 'Limited elevated access', permissions: ['users:read'] },
  { name: 'customer', description: 'Standard user', permissions: [] },
  { name: 'guest', description: 'Minimal access', permissions: [] },
];

/** Role assigned to newly registered users. */
export const DEFAULT_USER_ROLE = 'customer';

/** Resolves a role's effective permission keys. */
export function resolveRolePermissionKeys(role: RoleDef): readonly string[] {
  return role.permissions === '*' ? ALL_PERMISSION_KEYS : role.permissions;
}
