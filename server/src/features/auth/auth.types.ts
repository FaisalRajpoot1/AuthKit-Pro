import type { User } from '@prisma/client';

/** Public-safe user representation. Never includes the password hash. */
export interface UserDto {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: string;
}

/** Request-scoped metadata captured for auditing refresh tokens. */
export interface RequestContext {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

/** Result of any flow that issues a fresh token pair. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult {
  user: UserDto;
  tokens: AuthTokens;
}

/** Outcome of a login attempt: either fully authenticated or 2FA-gated. */
export type LoginResult =
  | ({ status: 'authenticated' } & AuthResult)
  | { status: 'two_factor_required'; challengeToken: string };

/** Result of completing a 2FA login, with an optional trusted-device cookie. */
export interface TwoFactorLoginResult extends AuthResult {
  trustedDevice?: { token: string; expiresAt: Date };
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
