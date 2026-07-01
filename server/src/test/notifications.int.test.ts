import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testUser } from './helpers';

const app = createApp();

async function registerAndToken(): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(testUser());
  return res.body.accessToken as string;
}

describe('notifications (integration)', () => {
  it('creates a security notification on password change and marks it read', async () => {
    const token = await registerAndToken();

    const changed = await request(app)
      .post('/api/v1/account/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: testUser().password, newPassword: 'NewPassw0rd!' });
    expect(changed.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(1);
    expect(list.body.items[0].type).toBe('SECURITY_ALERT');
    expect(list.body.items[0].title).toBe('Password changed');
    expect(list.body.items[0].read).toBe(false);

    const id = list.body.items[0].id as string;
    const markRead = await request(app)
      .post(`/api/v1/notifications/${id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(markRead.status).toBe(204);

    const count = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(count.body.unreadCount).toBe(0);
  });

  it('marks all read and deletes a notification', async () => {
    const token = await registerAndToken();
    await request(app)
      .post('/api/v1/account/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: testUser().password, newPassword: 'NewPassw0rd!' });

    const readAll = await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(readAll.status).toBe(200);
    expect(readAll.body.marked).toBeGreaterThanOrEqual(1);

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    const id = list.body.items[0].id as string;

    const del = await request(app)
      .delete(`/api/v1/notifications/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const after = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.items).toHaveLength(0);
  });
});
