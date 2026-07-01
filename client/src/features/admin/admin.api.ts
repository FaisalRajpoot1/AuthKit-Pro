import { apiClient } from '@/lib/apiClient';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface Permission {
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export async function listRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<{ roles: Role[] }>('/admin/roles');
  return data.roles;
}

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<{ permissions: Permission[] }>('/admin/permissions');
  return data.permissions;
}

export async function createRole(input: {
  name: string;
  description?: string | undefined;
  permissionKeys?: string[] | undefined;
}): Promise<Role> {
  const { data } = await apiClient.post<{ role: Role }>('/admin/roles', input);
  return data.role;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/admin/roles/${id}`);
}

export async function setRolePermissions(id: string, permissionKeys: string[]): Promise<Role> {
  const { data } = await apiClient.put<{ role: Role }>(`/admin/roles/${id}/permissions`, {
    permissionKeys,
  });
  return data.role;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number; active: number; verified: number; twoFactor: number; new7d: number; new30d: number };
  organizations: number;
  activeSessions: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  locked: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  memberCount: number;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats');
  return data;
}

export async function listUsers(
  params: { search?: string | undefined; cursor?: string | undefined } = {},
): Promise<Page<AdminUser>> {
  const { data } = await apiClient.get<Page<AdminUser>>('/admin/users', { params });
  return data;
}

export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/status`, { isActive });
}

export async function unlockUser(id: string): Promise<void> {
  await apiClient.post(`/admin/users/${id}/unlock`);
}

export async function listAdminAuditLogs(
  params: { cursor?: string | undefined } = {},
): Promise<Page<AdminAuditLog>> {
  const { data } = await apiClient.get<Page<AdminAuditLog>>('/admin/audit-logs', { params });
  return data;
}

export async function listAdminOrganizations(
  params: { search?: string | undefined; cursor?: string | undefined } = {},
): Promise<Page<AdminOrganization>> {
  const { data } = await apiClient.get<Page<AdminOrganization>>('/admin/organizations', { params });
  return data;
}
