import { apiClient } from '@/lib/apiClient';

export interface AppNotification {
  id: string;
  type: 'SECURITY_ALERT' | 'ACCOUNT' | 'INFO';
  title: string;
  body: string;
  metadata: unknown;
  read: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export async function listNotifications(): Promise<NotificationsPage> {
  const { data } = await apiClient.get<NotificationsPage>('/notifications');
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ unreadCount: number }>('/notifications/unread-count');
  return data.unreadCount;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
