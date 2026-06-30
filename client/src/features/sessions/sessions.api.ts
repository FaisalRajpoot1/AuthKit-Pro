import { apiClient } from '@/lib/apiClient';

/** A device session as returned by the API. */
export interface Session {
  id: string;
  current: boolean;
  ipAddress: string | null;
  location: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
}

export async function listSessions(): Promise<Session[]> {
  const { data } = await apiClient.get<{ sessions: Session[] }>('/sessions');
  return data.sessions;
}

export async function revokeSession(id: string): Promise<void> {
  await apiClient.delete(`/sessions/${id}`);
}

/** Log out every other device, keeping the current session. */
export async function revokeOtherSessions(): Promise<number> {
  const { data } = await apiClient.delete<{ revokedCount: number }>('/sessions');
  return data.revokedCount;
}
