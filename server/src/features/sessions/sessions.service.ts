import type { Prisma, Session } from '@prisma/client';
import { env } from '../../config/env';
import { parseDevice } from '../../lib/device';
import { lookupLocation } from '../../lib/geo';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import type { RequestContext } from '../auth/auth.types';
import { toSessionDto, type SessionDto } from './sessions.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Absolute expiry for a (sliding) session/refresh token from now. */
export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY);
}

type Db = Prisma.TransactionClient;

/** Creates a session row capturing the device that logged in. */
export function createSession(
  userId: string,
  context: RequestContext,
  expiresAt: Date,
  tx: Db = prisma,
): Promise<Session> {
  const device = parseDevice(context.userAgent);
  return tx.session.create({
    data: {
      userId,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      location: lookupLocation(context.ipAddress),
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      expiresAt,
    },
  });
}

/** Refreshes a session's sliding window and last-seen metadata on rotation. */
export function touchSession(
  sessionId: string,
  context: RequestContext,
  expiresAt: Date,
  tx: Db = prisma,
): Promise<unknown> {
  return tx.session.update({
    where: { id: sessionId },
    data: {
      lastUsedAt: new Date(),
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      location: lookupLocation(context.ipAddress),
    },
  });
}

/** Revokes one session and all its refresh tokens (idempotent). */
export async function revokeSession(sessionId: string, tx: Db = prisma): Promise<void> {
  const now = new Date();
  await tx.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
  await tx.refreshToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: now },
  });
}

/**
 * Revokes all of a user's sessions, optionally excluding one (e.g. the caller's
 * current session). Returns the number of sessions revoked.
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId: string | null = null,
  tx: Db = prisma,
): Promise<number> {
  const now = new Date();
  const exclusion = exceptSessionId ? { id: { not: exceptSessionId } } : {};

  const { count } = await tx.session.updateMany({
    where: { userId, revokedAt: null, ...exclusion },
    data: { revokedAt: now },
  });
  await tx.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: now },
  });

  return count;
}

/** Lists a user's active (non-revoked, non-expired) sessions, current first. */
export async function listSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionDto[]> {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });

  return sessions
    .map((session) => toSessionDto(session, currentSessionId))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Revokes a specific session the caller owns. Throws if it isn't theirs. */
export async function revokeUserSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  await revokeSession(sessionId);
}
