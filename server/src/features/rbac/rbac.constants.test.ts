import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSION_KEYS,
  SYSTEM_ROLES,
  permissionKey,
  resolveRolePermissionKeys,
} from './rbac.constants';

describe('rbac constants', () => {
  it('builds resource:action keys', () => {
    expect(permissionKey({ resource: 'users', action: 'manage' })).toBe('users:manage');
  });

  it('admin resolves to every permission', () => {
    const admin = SYSTEM_ROLES.find((r) => r.name === 'admin')!;
    expect(resolveRolePermissionKeys(admin)).toEqual(ALL_PERMISSION_KEYS);
  });

  it('customer resolves to no permissions', () => {
    const customer = SYSTEM_ROLES.find((r) => r.name === 'customer')!;
    expect(resolveRolePermissionKeys(customer)).toEqual([]);
  });

  it('every role references only known permission keys', () => {
    const known = new Set(ALL_PERMISSION_KEYS);
    for (const role of SYSTEM_ROLES) {
      const keys = resolveRolePermissionKeys(role);
      for (const key of keys) {
        expect(known.has(key)).toBe(true);
      }
    }
  });
});
