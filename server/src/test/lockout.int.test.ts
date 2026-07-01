import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { testUser } from './helpers';

const app = createApp();

async function failLogin(email: string): Promise<number> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: email, password: 'wrong-password' });
  return res.status;
}

describe('account lockout (integration)', () => {
  it('locks the account after 5 failed attempts', async () => {
    await request(app).post('/api/v1/auth/register').send(testUser());

    for (let i = 0; i < 5; i += 1) {
      expect(await failLogin(testUser().email)).toBe(401);
    }

    // Now locked: even the correct password is rejected with 429.
    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(locked.status).toBe(429);
  });

  it('resets the failure counter after a successful login', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(testUser());
    const userId = reg.body.user.id as string;

    await failLogin(testUser().email);
    await failLogin(testUser().email);

    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser().email, password: testUser().password });
    expect(ok.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
  });

  it('lets an admin unlock a locked account', async () => {
    // Admin
    const adminReg = await request(app).post('/api/v1/auth/register').send(testUser(1));
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    await prisma.userRole.create({ data: { userId: adminReg.body.user.id, roleId: adminRole.id } });
    const adminToken = adminReg.body.accessToken as string;

    // Victim, locked out
    const victim = await request(app).post('/api/v1/auth/register').send(testUser(2));
    const victimId = victim.body.user.id as string;
    for (let i = 0; i < 5; i += 1) await failLogin(testUser(2).email);
    const stillLocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser(2).email, password: testUser(2).password });
    expect(stillLocked.status).toBe(429);

    // Admin unlocks
    const unlock = await request(app)
      .post(`/api/v1/admin/users/${victimId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unlock.status).toBe(200);

    const afterUnlock = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: testUser(2).email, password: testUser(2).password });
    expect(afterUnlock.status).toBe(200);
  });
});
