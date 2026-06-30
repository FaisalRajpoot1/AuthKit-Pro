import type { AuditAction, Prisma } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import type { RequestContext } from '../auth/auth.types';

interface RecordAuditParams {
  action: AuditAction;
  userId?: string | null;
  context?: RequestContext;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Appends an entry to the audit trail. Best-effort: a logging failure must
 * never break the user-facing operation it records, so errors are swallowed
 * (and logged) rather than propagated.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        ipAddress: params.context?.ipAddress ?? null,
        userAgent: params.context?.userAgent ?? null,
        ...(params.metadata === undefined ? {} : { metadata: params.metadata }),
      },
    });
  } catch (error) {
    logger.error({ err: error, action: params.action }, 'Failed to write audit log');
  }
}

export interface AuditLogDto {
  id: string;
  action: AuditAction;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue;
  createdAt: string;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** Lists a user's own audit history, newest first, with cursor pagination. */
export async function listUserAuditLogs(
  userId: string,
  options: { limit?: number | undefined; cursor?: string | undefined } = {},
): Promise<{ items: AuditLogDto[]; nextCursor: string | null }> {
  const take = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const rows = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: take + 1, // fetch one extra to detect a next page
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
