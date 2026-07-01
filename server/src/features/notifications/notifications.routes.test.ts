import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

const app = createApp();

describe('notifications guards', () => {
  it('rejects listing notifications without auth (401)', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unread-count without auth (401)', async () => {
    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('rejects mark-all-read without auth (401)', async () => {
    const res = await request(app).post('/api/v1/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
