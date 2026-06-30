import { apiClient } from '@/lib/apiClient';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  myRole: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrgMember {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<{ organizations: Organization[] }>('/organizations');
  return data.organizations;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data } = await apiClient.post<{ organization: Organization }>('/organizations', { name });
  return data.organization;
}

export async function deleteOrganization(id: string): Promise<void> {
  await apiClient.delete(`/organizations/${id}`);
}

export async function leaveOrganization(id: string): Promise<void> {
  await apiClient.post(`/organizations/${id}/leave`);
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const { data } = await apiClient.get<{ members: OrgMember[] }>(`/organizations/${orgId}/members`);
  return data.members;
}

export async function inviteMember(orgId: string, email: string, role: 'ADMIN' | 'MEMBER'): Promise<void> {
  await apiClient.post(`/organizations/${orgId}/invites`, { email, role });
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await apiClient.delete(`/organizations/${orgId}/members/${userId}`);
}

export async function listTeams(orgId: string): Promise<Team[]> {
  const { data } = await apiClient.get<{ teams: Team[] }>(`/organizations/${orgId}/teams`);
  return data.teams;
}

export async function createTeam(orgId: string, name: string): Promise<Team> {
  const { data } = await apiClient.post<{ team: Team }>(`/organizations/${orgId}/teams`, { name });
  return data.team;
}

export async function deleteTeam(orgId: string, teamId: string): Promise<void> {
  await apiClient.delete(`/organizations/${orgId}/teams/${teamId}`);
}

export async function acceptInvite(token: string): Promise<Organization> {
  const { data } = await apiClient.post<{ organization: Organization }>(
    '/organizations/invites/accept',
    { token },
  );
  return data.organization;
}
