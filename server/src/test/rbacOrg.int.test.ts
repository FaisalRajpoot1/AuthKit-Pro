import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { emailService } from '../lib/email/email.service';
import { prisma } from '../lib/prisma';
import { testUser } from './helpers';

const app = createApp();

async function registerUser(n: number): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser(n));
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}

describe('RBAC (integration)', () => {
  it('denies admin endpoints to a default user, allows after granting admin', async () => {
    const { id, token } = await registerUser(1);

    const denied = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);

    // Grant the admin role directly (permissions resolve per-request from the DB).
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    await prisma.userRole.create({ data: { userId: id, roleId: adminRole.id } });

    const allowed = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.users.total).toBeGreaterThanOrEqual(1);
  });
});

describe('organizations (integration)', () => {
  it('creates an org, invites a member, and accepts the invite', async () => {
    const owner = await registerUser(1);
    const invitee = await registerUser(2);

    // Create
    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Acme Inc.' });
    expect(created.status).toBe(201);
    const orgId = created.body.organization.id as string;
    expect(created.body.organization.myRole).toBe('OWNER');

    // Invite — capture the raw token from the email service.
    const spy = vi.spyOn(emailService, 'sendOrganizationInviteEmail').mockResolvedValue();
    const invited = await request(app)
      .post(`/api/v1/organizations/${orgId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: testUser(2).email, role: 'MEMBER' });
    expect(invited.status).toBe(202);
    const inviteToken = spy.mock.calls[0]?.[2] as string;
    spy.mockRestore();
    expect(inviteToken).toBeTruthy();

    // Accept as the invitee
    const accepted = await request(app)
      .post('/api/v1/organizations/invites/accept')
      .set('Authorization', `Bearer ${invitee.token}`)
      .send({ token: inviteToken });
    expect(accepted.status).toBe(200);

    // Membership now has two users
    const members = await request(app)
      .get(`/api/v1/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(members.body.members).toHaveLength(2);
  });

  it('transfers ownership', async () => {
    const owner = await registerUser(1);
    const member = await registerUser(2);

    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Transfer Co.' });
    const orgId = created.body.organization.id as string;

    // Add the member directly, then transfer ownership to them.
    await prisma.organizationMember.create({
      data: { organizationId: orgId, userId: member.id, role: 'MEMBER' },
    });

    const transferred = await request(app)
      .post(`/api/v1/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ userId: member.id });
    expect(transferred.status).toBe(200);

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.ownerId).toBe(member.id);
  });
});
