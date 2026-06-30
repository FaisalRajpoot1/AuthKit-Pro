import { apiClient } from '@/lib/apiClient';

export interface AuditLog {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  nextCursor: string | null;
}

export async function listAuditLogs(limit = 10): Promise<AuditLogPage> {
  const { data } = await apiClient.get<AuditLogPage>('/audit-logs', { params: { limit } });
  return data;
}
