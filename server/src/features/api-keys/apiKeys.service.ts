import { randomBytes } from 'node:crypto';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { hashToken } from '../../lib/tokens';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import { API_SCOPE_KEYS, isValidScope } from './apiKeys.constants';
import type { CreateApiKeyInput } from './apiKeys.schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'ak_';
const DISPLAY_PREFIX_LENGTH = 12;

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

function toDto(key: {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    revoked: key.revokedAt !== null,
    createdAt: key.createdAt.toISOString(),
  };
}

/** Generates an opaque API key and its stored hash + display prefix. */
function generateKey(): { secret: string; hash: string; prefix: string } {
  const secret = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { secret, hash: hashToken(secret), prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/**
 * Creates an API key. The full secret is returned exactly once here; only its
 * hash is stored. Scopes must be from the supported allowlist.
 */
export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
  context: RequestContext,
): Promise<{ apiKey: ApiKeyDto; secret: string }> {
  const unknown = input.scopes.filter((s) => !isValidScope(s));
  if (unknown.length > 0) {
    throw new ValidationError(
      `Unknown scope(s): ${unknown.join(', ')}. Allowed: ${API_SCOPE_KEYS.join(', ')}`,
    );
  }

  const { secret, hash, prefix } = generateKey();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * MS_PER_DAY)
    : null;

  const created = await prisma.apiKey.create({
    data: {
      userId,
      name: input.name,
      prefix,
      keyHash: hash,
      scopes: [...new Set(input.scopes)],
      expiresAt,
    },
  });

  await recordAudit({ action: 'API_KEY_CREATED', userId, context, metadata: { apiKeyId: created.id } });
  logger.info({ userId, apiKeyId: created.id }, 'API key created');
  return { apiKey: toDto(created), secret };
}

export async function listApiKeys(userId: string): Promise<ApiKeyDto[]> {
  const keys = await prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return keys.map(toDto);
}

export async function revokeApiKey(
  userId: string,
  apiKeyId: string,
  context: RequestContext,
): Promise<void> {
  const key = await prisma.apiKey.findFirst({ where: { id: apiKeyId, userId }, select: { id: true } });
  if (!key) throw new NotFoundError('API key not found');

  await prisma.apiKey.updateMany({
    where: { id: apiKeyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordAudit({ action: 'API_KEY_REVOKED', userId, context, metadata: { apiKeyId } });
}

/**
 * Authenticates a raw API key: validates it exists, is not revoked/expired,
 * updates last-used, and returns the owning user and granted scopes.
 */
export async function authenticateApiKey(
  rawKey: string,
): Promise<{ userId: string; scopes: string[] }> {
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashToken(rawKey) },
    select: {
      id: true,
      userId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { isActive: true, deletedAt: true } },
    },
  });

  if (
    !key ||
    key.revokedAt !== null ||
    (key.expiresAt !== null && key.expiresAt.getTime() < Date.now()) ||
    !key.user.isActive ||
    key.user.deletedAt !== null
  ) {
    throw new UnauthorizedError('Invalid or expired API key');
  }

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { userId: key.userId, scopes: key.scopes };
}
