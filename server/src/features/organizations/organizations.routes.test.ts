import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { orgRoleAtLeast } from './organizations.types';

const app = createApp();

describe('org role hierarchy', () => {
  it('ranks OWNER >= ADMIN >= MEMBER', () => {
    expect(orgRoleAtLeast('OWNER', 'ADMIN')).toBe(true);
    expect(orgRoleAtLeast('ADMIN', 'MEMBER')).toBe(true);
    expect(orgRoleAtLeast('MEMBER', 'ADMIN')).toBe(false);
    expect(orgRoleAtLeast('ADMIN', 'OWNER')).toBe(false);
  });
});

describe('organizations route guards', () => {
  it('rejects listing organizations without auth (401)', async () => {
    const res = await request(app).get('/api/v1/organizations');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects creating an organization without auth (401)', async () => {
    const res = await request(app).post('/api/v1/organizations').send({ name: 'Acme' });
    expect(res.status).toBe(401);
  });

  it('rejects accepting an invite without auth (401)', async () => {
    const res = await request(app).post('/api/v1/organizations/invites/accept').send({ token: 'x' });
    expect(res.status).toBe(401);
  });
});
