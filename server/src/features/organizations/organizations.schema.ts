import { z } from 'zod';

const orgRoleSchema = z.enum(['ADMIN', 'MEMBER']); // OWNER is set via transfer only

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).trim(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(60).trim(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase().trim(),
  role: orgRoleSchema.default('MEMBER'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const changeMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

export const transferOwnershipSchema = z.object({
  userId: z.string().uuid(),
});

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).trim(),
});

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['LEAD', 'MEMBER']).default('MEMBER'),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
