import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { invalidateBlockedIpCache } from '../features/ip-blocking/ipBlocking.service';
import { prisma } from '../lib/prisma';
import { testUser } from './helpers';

const app = createApp();

async function registerAdmin(n: number): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser(n));
  const id = res.body.user.id as string;
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  await prisma.userRole.create({ data: { userId: id, roleId: adminRole.id } });
  return { id, token: res.body.accessToken as string };
}

describe('IP blocking (integration)', () => {
  // The guard caches the active set in-process; clear it so a leftover cache
  // from one test cannot bleed into the next.
  afterEach(() => invalidateBlockedIpCache());

  it('blocks, lists, and unblocks an IP as an admin', async () => {
    const admin = await registerAdmin(1);

    const created = await request(app)
      .post('/api/v1/admin/blocked-ips')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ipAddress: '203.0.113.7', reason: 'abuse' });
    expect(created.status).toBe(201);
    expect(created.body.blockedIp.ipAddress).toBe('203.0.113.7');
    const blockId = created.body.blockedIp.id as string;

    const listed = await request(app)
      .get('/api/v1/admin/blocked-ips')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.blockedIps).toHaveLength(1);

    const removed = await request(app)
      .delete(`/api/v1/admin/blocked-ips/${blockId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(removed.status).toBe(200);

    expect(await prisma.blockedIp.count()).toBe(0);
  });

  it('rejects a duplicate block with 409', async () => {
    const admin = await registerAdmin(1);
    const send = () =>
      request(app)
        .post('/api/v1/admin/blocked-ips')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ ipAddress: '203.0.113.8' });

    expect((await send()).status).toBe(201);
    const dup = await send();
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid IP with 400', async () => {
    const admin = await registerAdmin(1);
    const res = await request(app)
      .post('/api/v1/admin/blocked-ips')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ipAddress: 'not-an-ip' });
    expect(res.status).toBe(400);
  });

  it('turns away a request from a blocked IP (via X-Forwarded-For)', async () => {
    const admin = await registerAdmin(1);
    await request(app)
      .post('/api/v1/admin/blocked-ips')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ipAddress: '198.51.100.42' });

    // trust proxy is on, so X-Forwarded-For sets req.ip.
    const blocked = await request(app)
      .get('/api/v1/health/live')
      .set('X-Forwarded-For', '198.51.100.42');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('FORBIDDEN');

    // A different IP is unaffected.
    const allowed = await request(app)
      .get('/api/v1/health/live')
      .set('X-Forwarded-For', '198.51.100.43');
    expect(allowed.status).toBe(200);
  });

  it('requires the ip_blocks permission', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser(2));
    const token = res.body.accessToken as string;
    const denied = await request(app)
      .get('/api/v1/admin/blocked-ips')
      .set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);
  });
});
