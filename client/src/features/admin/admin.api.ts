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
