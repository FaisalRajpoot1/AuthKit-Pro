import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

/** Auth-guard tests for Phase 3 endpoints (resolve before any DB access). */
const app = createApp();

describe('sessions guards', () => {
  it('rejects listing sessions without auth (401)', async () => {
    const res = await request(app).get('/api/v1/sessions');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects revoke-all without auth (401)', async () => {
    const res = await request(app).delete('/api/v1/sessions');
    expect(res.status).toBe(401);
  });
});

describe('audit-log guards', () => {
  it('rejects reading audit logs without auth (401)', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
