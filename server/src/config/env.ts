import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { productionSafetyIssues } from './productionSafety';

loadDotenv();

/**
 * Environment schema. Validated once at startup so the rest of the app can
 * rely on a fully-typed, present config object. Fail fast on misconfiguration.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),

  // Base64-encoded 32-byte key for AES-256-GCM (encrypts TOTP secrets at rest).
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    }),

  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),

  // Public URL of the frontend — used to build links in emails.
  APP_URL: z.string().url().default('http://localhost:5173'),

  // Serve interactive API docs (Swagger UI) at /api/v1/docs.
  API_DOCS_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),

  // Single-use token lifetimes.
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // Two-factor authentication.
  TOTP_ISSUER: z.string().default('AuthKit Pro'),
  TRUSTED_DEVICE_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // WebAuthn / passkeys. RP ID is the registrable domain (no scheme/port);
  // origin is the full frontend origin. Defaults suit local development.
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('AuthKit Pro'),
  WEBAUTHN_ORIGIN: z.string().url().default('http://localhost:5173'),

  // OAuth. Public base URL of THIS API (for building provider redirect URIs).
  SERVER_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Email delivery. When SMTP_HOST is unset, emails are logged to the console
  // (development) instead of sent — handy for local flows without a mailserver.
  EMAIL_FROM: z.string().default('AuthKit Pro <no-reply@authkit.local>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Fail fast in production on weak/default secrets or insecure cookie settings.
if (isProduction) {
  const issues = productionSafetyIssues({
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
    cookieSecure: env.COOKIE_SECURE,
  });

  if (issues.length > 0) {
    // eslint-disable-next-line no-console
    console.error('❌ Refusing to start in production — insecure configuration:');
    for (const issue of issues) {
      // eslint-disable-next-line no-console
      console.error(`  • ${issue}`);
    }
    process.exit(1);
  }
}
