import type { Response } from 'supertest';

export const REFRESH_COOKIE = 'authkit_refresh_token';

/** Extracts a `name=value` cookie pair from a response's Set-Cookie header. */
export function getSetCookie(res: Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const found = raw?.find((cookie) => cookie.startsWith(`${name}=`));
  return found ? (found.split(';')[0] ?? undefined) : undefined;
}

/** Deterministic test-user payloads. */
export function testUser(n = 1): {
  email: string;
  username: string;
  password: string;
  displayName: string;
} {
  return {
    email: `user${n}@test.dev`,
    username: `user${n}`,
    password: 'Passw0rd!',
    displayName: `User ${n}`,
  };
}
