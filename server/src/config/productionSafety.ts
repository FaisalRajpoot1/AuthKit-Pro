/**
 * Production safety checks. Kept as a pure function (no process/exit) so it can
 * be unit-tested; `env.ts` runs it at startup and refuses to boot when it
 * returns any issues in production.
 */
export interface SecurityConfigView {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  cookieSecure: boolean;
}

/** Exact placeholder/dev/test values that must never reach production. */
const KNOWN_INSECURE_VALUES = new Set([
  'change_me_access_secret',
  'change_me_refresh_secret',
  'change_me_base64_32_byte_key',
  'test_access_secret_at_least_32_chars_long_xx',
  'test_refresh_secret_at_least_32_chars_long_x',
  'JB6IodCakx3kzIvrFGpV5mhh0CHabl4MPeJI7PVvV1U=',
]);

/** Substrings/patterns that indicate a placeholder rather than a real secret. */
const WEAK_MARKERS = [/change[_-]?me/i, /changeme/i, /placeholder/i, /example/i, /^dev[_-]/i, /^test[_-]/i];

function isWeakSecret(value: string): boolean {
  return KNOWN_INSECURE_VALUES.has(value) || WEAK_MARKERS.some((re) => re.test(value));
}

/**
 * Returns a list of human-readable configuration problems that make the app
 * unsafe to run in production. An empty list means the config passed.
 */
export function productionSafetyIssues(config: SecurityConfigView): string[] {
  const issues: string[] = [];

  const secrets: Array<[name: string, value: string]> = [
    ['JWT_ACCESS_SECRET', config.jwtAccessSecret],
    ['JWT_REFRESH_SECRET', config.jwtRefreshSecret],
    ['ENCRYPTION_KEY', config.encryptionKey],
  ];

  for (const [name, value] of secrets) {
    if (isWeakSecret(value)) {
      issues.push(`${name} looks like a placeholder/dev value — generate a fresh secret.`);
    }
  }

  if (config.jwtAccessSecret === config.jwtRefreshSecret) {
    issues.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  if (!config.cookieSecure) {
    issues.push('COOKIE_SECURE must be true in production (serve over HTTPS).');
  }

  return issues;
}
