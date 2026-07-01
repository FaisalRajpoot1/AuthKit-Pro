import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { env } from '../../config/env';
import { signWebAuthnChallenge, verifyWebAuthnChallenge } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../audit/audit.service';
import { issueAuthenticatedSession } from '../auth/auth.service';
import type { AuthResult, RequestContext } from '../auth/auth.types';

export type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]['response'];
export type AuthenticationResponse = Parameters<typeof verifyAuthenticationResponse>[0]['response'];
type Transport = 'usb' | 'ble' | 'nfc' | 'internal' | 'hybrid' | 'smart-card' | 'cable';

const RP_ID = env.WEBAUTHN_RP_ID;
const RP_NAME = env.WEBAUTHN_RP_NAME;
const ORIGIN = env.WEBAUTHN_ORIGIN;

export interface PasskeyDto {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

function toDto(p: {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
}): PasskeyDto {
  return {
    id: p.id,
    name: p.name,
    deviceType: p.deviceType,
    backedUp: p.backedUp,
    transports: p.transports,
    lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

// ── Registration (authenticated) ─────────────────────────────────────────────

export async function getRegistrationOptions(
  userId: string,
): Promise<{ options: Awaited<ReturnType<typeof generateRegistrationOptions>>; challengeToken: string }> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, displayName: true, passkeys: { select: { credentialId: true, transports: true } } },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.displayName ?? user.email,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as Transport[],
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });

  const challengeToken = signWebAuthnChallenge({ challenge: options.challenge, purpose: 'register', userId });
  return { options, challengeToken };
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponse,
  challengeToken: string,
  name: string | undefined,
  context: RequestContext,
): Promise<PasskeyDto> {
  const challenge = verifyWebAuthnChallenge(challengeToken);
  if (challenge.purpose !== 'register' || challenge.userId !== userId) {
    throw new UnauthorizedError('Invalid registration challenge');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ValidationError('Passkey registration could not be verified');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const created = await prisma.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (response.response.transports ?? []) as string[],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name?.trim() || null,
    },
  });

  await recordAudit({ action: 'PASSKEY_REGISTERED', userId, context, metadata: { passkeyId: created.id } });
  logger.info({ userId, passkeyId: created.id }, 'Passkey registered');
  return toDto(created);
}

// ── Authentication (public) ──────────────────────────────────────────────────

export async function getAuthenticationOptions(
  email: string | undefined,
): Promise<{ options: Awaited<ReturnType<typeof generateAuthenticationOptions>>; challengeToken: string }> {
  const user = email
    ? await prisma.user.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
        select: { id: true, passkeys: { select: { credentialId: true, transports: true } } },
      })
    : null;

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: (user?.passkeys ?? []).map((p) => ({
      id: p.credentialId,
      transports: p.transports as Transport[],
    })),
  });

  const challengeToken = signWebAuthnChallenge({
    challenge: options.challenge,
    purpose: 'authenticate',
    ...(user ? { userId: user.id } : {}),
  });
  return { options, challengeToken };
}

export async function verifyAuthentication(
  response: AuthenticationResponse,
  challengeToken: string,
  context: RequestContext,
): Promise<AuthResult> {
  const challenge = verifyWebAuthnChallenge(challengeToken);
  if (challenge.purpose !== 'authenticate') {
    throw new UnauthorizedError('Invalid authentication challenge');
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });
  if (!passkey || !passkey.user.isActive || passkey.user.deletedAt) {
    throw new UnauthorizedError('Passkey not recognized');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as Transport[],
    },
  });

  if (!verification.verified) {
    throw new UnauthorizedError('Passkey authentication failed');
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  // A passkey is phishing-resistant strong auth, so it completes login directly.
  const result = await issueAuthenticatedSession(passkey.user, context);
  await recordAudit({ action: 'PASSKEY_LOGIN', userId: passkey.userId, context });
  await recordAudit({ action: 'USER_LOGIN', userId: passkey.userId, context });
  return result;
}

// ── Management ───────────────────────────────────────────────────────────────

export async function listPasskeys(userId: string): Promise<PasskeyDto[]> {
  const passkeys = await prisma.passkey.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return passkeys.map(toDto);
}

export async function deletePasskey(userId: string, passkeyId: string, context: RequestContext): Promise<void> {
  const passkey = await prisma.passkey.findFirst({ where: { id: passkeyId, userId }, select: { id: true } });
  if (!passkey) throw new NotFoundError('Passkey not found');
  await prisma.passkey.delete({ where: { id: passkeyId } });
  await recordAudit({ action: 'PASSKEY_REMOVED', userId, context, metadata: { passkeyId } });
}
