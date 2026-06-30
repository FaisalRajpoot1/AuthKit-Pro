import type { Session } from '@prisma/client';

/** Public representation of a device session for the sessions dashboard. */
export interface SessionDto {
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

export function toSessionDto(session: Session, currentSessionId: string | null): SessionDto {
  return {
    id: session.id,
    current: session.id === currentSessionId,
    ipAddress: session.ipAddress,
    location: session.location,
    deviceType: session.deviceType,
    browser: session.browser,
    os: session.os,
    lastUsedAt: session.lastUsedAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}
