import type { BlockedIp } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import type { RequestContext } from '../auth/auth.types';
import { recordAudit } from '../audit/audit.service';
import { ConflictError, NotFoundError } from '../../utils/errors';

/**
 * How long the in-memory set of active blocks is trusted before it is reloaded
 * from the database. The guard runs on every API request, so we avoid a query
 * per request; block/unblock mutations invalidate the cache for immediacy.
 */
const CACHE_TTL_MS = 10_000;

let cache: { ips: Set<string>; loadedAt: number } | null = null;

/** Drops the cached block set so the next lookup reloads it from the database. */
export function invalidateBlockedIpCache(): void {
  cache = null;
}

/** Loads the currently-active blocked IPs (permanent, or not yet expired). */
async function loadActiveBlockedIps(): Promise<Set<string>> {
  const rows = await prisma.blockedIp.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { ipAddress: true },
  });
  return new Set(rows.map((row) => row.ipAddress));
}

/**
 * Whether an IP is currently blocked. Fails open: if the lookup errors (e.g. a
 * transient database problem) the request is allowed rather than everyone being
 * locked out, matching the availability-first posture of the other guards.
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  try {
    if (!cache || Date.now() - cache.loadedAt >= CACHE_TTL_MS) {
      cache = { ips: await loadActiveBlockedIps(), loadedAt: Date.now() };
    }
    return cache.ips.has(ip);
  } catch (error) {
    logger.warn({ err: error }, 'IP block lookup failed; allowing request (fail-open)');
    return false;
  }
}

export interface BlockedIpDto {
  id: string;
  ipAddress: string;
  reason: string | null;
  createdBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function toDto(row: BlockedIp): BlockedIpDto {
  return {
    id: row.id,
    ipAddress: row.ipAddress,
    reason: row.reason,
    createdBy: row.createdBy,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Blocks an IP address. Re-blocking an already-blocked IP is a conflict. */
export async function blockIp(
  params: { ipAddress: string; reason?: string | undefined; expiresAt?: Date | undefined },
  actingUserId: string,
  context: RequestContext,
): Promise<BlockedIpDto> {
  const existing = await prisma.blockedIp.findUnique({ where: { ipAddress: params.ipAddress } });
  if (existing) {
    throw new ConflictError('That IP address is already blocked');
  }

  const row = await prisma.blockedIp.create({
    data: {
      ipAddress: params.ipAddress,
      reason: params.reason ?? null,
      createdBy: actingUserId,
      expiresAt: params.expiresAt ?? null,
    },
  });
  invalidateBlockedIpCache();

  await recordAudit({
    action: 'IP_BLOCKED',
    userId: actingUserId,
    context,
    metadata: { ipAddress: row.ipAddress, ...(row.reason ? { reason: row.reason } : {}) },
  });

  return toDto(row);
}

/** Removes a block by its id. */
export async function unblockIp(
  id: string,
  actingUserId: string,
  context: RequestContext,
): Promise<void> {
  const row = await prisma.blockedIp.findUnique({ where: { id } });
  if (!row) {
    throw new NotFoundError('Blocked IP not found');
  }

  await prisma.blockedIp.delete({ where: { id } });
  invalidateBlockedIpCache();

  await recordAudit({
    action: 'IP_UNBLOCKED',
    userId: actingUserId,
    context,
    metadata: { ipAddress: row.ipAddress },
  });
}

/** Lists blocked IPs, newest first. */
export async function listBlockedIps(): Promise<BlockedIpDto[]> {
  const rows = await prisma.blockedIp.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toDto);
}
