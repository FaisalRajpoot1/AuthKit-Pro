import type { OrgRole } from '@prisma/client';

/** Role hierarchy for org-scoped authorization (higher = more privilege). */
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export function orgRoleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[minimum];
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  myRole: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationMemberDto {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface TeamMemberDto {
  userId: string;
  username: string;
  displayName: string | null;
  role: 'LEAD' | 'MEMBER';
  joinedAt: string;
}
