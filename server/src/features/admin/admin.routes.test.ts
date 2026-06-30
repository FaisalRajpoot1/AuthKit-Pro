import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Auth-guard tests for admin endpoints (resolve before DB/permission checks). */
const app = createApp();

describe('admin route guards', () => {
  it('rejects listing roles without auth (401)', async () => {
    const res = await request(app).get('/api/v1/admin/roles');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects listing permissions without auth (401)', async () => {
    const res = await request(app).get('/api/v1/admin/permissions');
    expect(res.status).toBe(401);
  });

  it('rejects creating a role without auth (401)', async () => {
    const res = await request(app).post('/api/v1/admin/roles').send({ name: 'editor2' });
    expect(res.status).toBe(401);
  });

  it('rejects assigning user roles without auth (401)', async () => {
    const res = await request(app)
      .put('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/roles')
      .send({ roleIds: [] });
    expect(res.status).toBe(401);
  });
});
