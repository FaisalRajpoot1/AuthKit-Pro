import { env } from '../config/env';

/**
 * OpenAPI 3 description of the AuthKit Pro API. Covers the core authentication,
 * account, session, 2FA, passwordless, API-key, and admin surfaces. Served as
 * Swagger UI at /api/v1/docs and raw JSON at /api/v1/openapi.json.
 */

const bearer = [{ bearerAuth: [] }];
const apiKey = [{ apiKeyAuth: [] }];

const jsonBody = (schema: object): object => ({
  required: true,
  content: { 'application/json': { schema } },
});
const jsonResponse = (description: string, schema: object): object => ({
  description,
  content: { 'application/json': { schema } },
});
const ref = (name: string): object => ({ $ref: `#/components/schemas/${name}` });

const commonResponses = {
  400: jsonResponse('Validation error', ref('Error')),
  401: jsonResponse('Unauthorized', ref('Error')),
  403: jsonResponse('Forbidden', ref('Error')),
  404: jsonResponse('Not found', ref('Error')),
  409: jsonResponse('Conflict', ref('Error')),
  429: jsonResponse('Too many requests', ref('Error')),
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'AuthKit Pro API',
    version: '1.0.0',
    description:
      'Production-ready authentication & authorization API. Most endpoints use a Bearer access token; the refresh token is an httpOnly cookie. API keys authenticate via the X-API-Key header.',
  },
  servers: [{ url: `${env.SERVER_PUBLIC_URL}/api/v1`, description: 'This server' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, tokens' },
    { name: 'Passwordless', description: 'Magic link & email OTP sign-in' },
    { name: 'Email', description: 'Email verification' },
    { name: 'Password', description: 'Password reset' },
    { name: 'Account', description: 'Profile & account settings' },
    { name: 'Two-Factor', description: 'TOTP 2FA' },
    { name: 'Sessions', description: 'Device sessions' },
    { name: 'API Keys', description: 'Programmatic access keys' },
    { name: 'Programmatic', description: 'API-key authenticated endpoints' },
    { name: 'Audit', description: 'Audit history' },
    { name: 'Admin', description: 'Administrative (permission-gated)' },
    { name: 'Organizations', description: 'Organizations & teams' },
    { name: 'Health', description: 'Liveness & readiness' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'authkit_refresh_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
      },
      Message: { type: 'object', properties: { message: { type: 'string' } } },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          displayName: { type: 'string', nullable: true },
          emailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: { user: ref('User'), accessToken: { type: 'string' } },
      },
      LoginResponse: {
        oneOf: [
          ref('AuthResponse'),
          {
            type: 'object',
            properties: {
              twoFactorRequired: { type: 'boolean', example: true },
              challengeToken: { type: 'string' },
            },
          },
        ],
      },
      Profile: {
        type: 'object',
        properties: {
          user: ref('User'),
          roles: { type: 'array', items: { type: 'string' } },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          current: { type: 'boolean' },
          ipAddress: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
          deviceType: { type: 'string', nullable: true },
          browser: { type: 'string', nullable: true },
          os: { type: 'string', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          prefix: { type: 'string' },
          scopes: { type: 'array', items: { type: 'string' } },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          revoked: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health/live': {
      get: { tags: ['Health'], summary: 'Liveness probe', responses: { 200: jsonResponse('OK', ref('Message')) } },
    },
    '/health/ready': {
      get: { tags: ['Health'], summary: 'Readiness probe (checks DB)', responses: { 200: jsonResponse('OK', ref('Message')) } },
    },

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account',
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'username', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            username: { type: 'string', minLength: 3, maxLength: 30 },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string' },
          },
        }),
        responses: { 201: jsonResponse('Created', ref('AuthResponse')), 400: commonResponses[400], 409: commonResponses[409] },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email/username + password',
        description: 'Returns tokens, or a 2FA challenge if two-factor is enabled.',
        requestBody: jsonBody({
          type: 'object',
          required: ['identifier', 'password'],
          properties: { identifier: { type: 'string' }, password: { type: 'string' } },
        }),
        responses: { 200: jsonResponse('Authenticated or 2FA required', ref('LoginResponse')), 401: commonResponses[401] },
      },
    },
    '/auth/2fa/login': {
      post: {
        tags: ['Auth'],
        summary: 'Complete a 2FA login',
        requestBody: jsonBody({
          type: 'object',
          required: ['challengeToken', 'code'],
          properties: {
            challengeToken: { type: 'string' },
            code: { type: 'string', description: 'TOTP or backup code' },
            trustDevice: { type: 'boolean' },
          },
        }),
        responses: { 200: jsonResponse('Authenticated', ref('AuthResponse')), 401: commonResponses[401] },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token, get a new access token',
        security: [{ cookieAuth: [] }],
        responses: { 200: jsonResponse('New access token', ref('AuthResponse')), 401: commonResponses[401] },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke the current session', security: [{ cookieAuth: [] }], responses: { 204: { description: 'Logged out' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user with roles & permissions', security: bearer, responses: { 200: jsonResponse('Profile', ref('Profile')), 401: commonResponses[401] } },
    },

    '/auth/email/verify': {
      post: { tags: ['Email'], summary: 'Verify email with a token', requestBody: jsonBody({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }), responses: { 200: jsonResponse('Verified', ref('Message')), 400: commonResponses[400] } },
    },
    '/auth/email/resend': {
      post: { tags: ['Email'], summary: 'Resend verification email', security: bearer, responses: { 202: jsonResponse('Sent', ref('Message')), 401: commonResponses[401] } },
    },

    '/auth/password/forgot': {
      post: { tags: ['Password'], summary: 'Request a password reset link', requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }), responses: { 202: jsonResponse('Accepted (enumeration-safe)', ref('Message')) } },
    },
    '/auth/password/reset': {
      post: { tags: ['Password'], summary: 'Reset password with a token', requestBody: jsonBody({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } }), responses: { 200: jsonResponse('Reset', ref('Message')), 400: commonResponses[400] } },
    },

    '/auth/passwordless/magic-link/request': {
      post: { tags: ['Passwordless'], summary: 'Email a magic sign-in link', requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }), responses: { 202: jsonResponse('Accepted (enumeration-safe)', ref('Message')) } },
    },
    '/auth/passwordless/magic-link/verify': {
      post: { tags: ['Passwordless'], summary: 'Complete sign-in with a magic-link token', requestBody: jsonBody({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }), responses: { 200: jsonResponse('Authenticated or 2FA required', ref('LoginResponse')), 400: commonResponses[400] } },
    },
    '/auth/passwordless/otp/request': {
      post: { tags: ['Passwordless'], summary: 'Email a one-time login code', requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }), responses: { 202: jsonResponse('Accepted (enumeration-safe)', ref('Message')) } },
    },
    '/auth/passwordless/otp/verify': {
      post: { tags: ['Passwordless'], summary: 'Complete sign-in with an email code', requestBody: jsonBody({ type: 'object', required: ['email', 'code'], properties: { email: { type: 'string', format: 'email' }, code: { type: 'string', pattern: '^\\d{6}$' } } }), responses: { 200: jsonResponse('Authenticated or 2FA required', ref('LoginResponse')), 400: commonResponses[400] } },
    },

    '/account/profile': {
      patch: { tags: ['Account'], summary: 'Update profile', security: bearer, requestBody: jsonBody({ type: 'object', properties: { displayName: { type: 'string', nullable: true } } }), responses: { 200: jsonResponse('Updated', { type: 'object', properties: { user: ref('User') } }), 401: commonResponses[401] } },
    },
    '/account/change-password': {
      post: { tags: ['Account'], summary: 'Change password', security: bearer, requestBody: jsonBody({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } }), responses: { 200: jsonResponse('Changed', ref('Message')), 401: commonResponses[401] } },
    },
    '/account/change-email': {
      post: { tags: ['Account'], summary: 'Request an email change', security: bearer, requestBody: jsonBody({ type: 'object', required: ['newEmail', 'currentPassword'], properties: { newEmail: { type: 'string', format: 'email' }, currentPassword: { type: 'string' } } }), responses: { 202: jsonResponse('Confirmation sent', ref('Message')), 401: commonResponses[401], 409: commonResponses[409] } },
    },
    '/account': {
      delete: { tags: ['Account'], summary: 'Delete (soft) the account', security: bearer, requestBody: jsonBody({ type: 'object', required: ['currentPassword'], properties: { currentPassword: { type: 'string' } } }), responses: { 204: { description: 'Deleted' }, 401: commonResponses[401] } },
    },
    '/account/availability': {
      get: { tags: ['Account'], summary: 'Check username/email availability', parameters: [{ name: 'username', in: 'query', schema: { type: 'string' } }, { name: 'email', in: 'query', schema: { type: 'string' } }], responses: { 200: jsonResponse('Availability', { type: 'object', properties: { username: { type: 'boolean' }, email: { type: 'boolean' } } }), 400: commonResponses[400] } },
    },

    '/account/2fa': {
      get: { tags: ['Two-Factor'], summary: '2FA status', security: bearer, responses: { 200: jsonResponse('Status', { type: 'object', properties: { enabled: { type: 'boolean' }, backupCodesRemaining: { type: 'integer' } } }), 401: commonResponses[401] } },
    },
    '/account/2fa/setup': {
      post: { tags: ['Two-Factor'], summary: 'Start 2FA enrollment (QR + secret)', security: bearer, responses: { 200: jsonResponse('Setup', { type: 'object', properties: { secret: { type: 'string' }, otpauthUrl: { type: 'string' }, qrCodeDataUrl: { type: 'string' } } }), 401: commonResponses[401] } },
    },
    '/account/2fa/enable': {
      post: { tags: ['Two-Factor'], summary: 'Enable 2FA (returns backup codes)', security: bearer, requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }), responses: { 200: jsonResponse('Enabled', { type: 'object', properties: { backupCodes: { type: 'array', items: { type: 'string' } } } }), 400: commonResponses[400] } },
    },
    '/account/2fa/disable': {
      post: { tags: ['Two-Factor'], summary: 'Disable 2FA', security: bearer, requestBody: jsonBody({ type: 'object', required: ['password'], properties: { password: { type: 'string' } } }), responses: { 200: jsonResponse('Disabled', ref('Message')), 401: commonResponses[401] } },
    },
    '/account/2fa/backup-codes': {
      post: { tags: ['Two-Factor'], summary: 'Regenerate backup codes', security: bearer, requestBody: jsonBody({ type: 'object', required: ['password'], properties: { password: { type: 'string' } } }), responses: { 200: jsonResponse('New codes', { type: 'object', properties: { backupCodes: { type: 'array', items: { type: 'string' } } } }), 401: commonResponses[401] } },
    },

    '/sessions': {
      get: { tags: ['Sessions'], summary: 'List active sessions', security: bearer, responses: { 200: jsonResponse('Sessions', { type: 'object', properties: { sessions: { type: 'array', items: ref('Session') } } }), 401: commonResponses[401] } },
      delete: { tags: ['Sessions'], summary: 'Log out other devices', security: bearer, responses: { 200: jsonResponse('Revoked', { type: 'object', properties: { revokedCount: { type: 'integer' } } }), 401: commonResponses[401] } },
    },
    '/sessions/{id}': {
      delete: { tags: ['Sessions'], summary: 'Revoke a session', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Revoked' }, 401: commonResponses[401], 404: commonResponses[404] } },
    },

    '/account/api-keys': {
      get: { tags: ['API Keys'], summary: 'List API keys', security: bearer, responses: { 200: jsonResponse('Keys', { type: 'object', properties: { apiKeys: { type: 'array', items: ref('ApiKey') } } }), 401: commonResponses[401] } },
      post: { tags: ['API Keys'], summary: 'Create an API key (secret returned once)', security: bearer, requestBody: jsonBody({ type: 'object', required: ['name', 'scopes'], properties: { name: { type: 'string' }, scopes: { type: 'array', items: { type: 'string' } }, expiresInDays: { type: 'integer' } } }), responses: { 201: jsonResponse('Created', { type: 'object', properties: { apiKey: ref('ApiKey'), secret: { type: 'string' } } }), 400: commonResponses[400], 401: commonResponses[401] } },
    },
    '/account/api-keys/{id}': {
      delete: { tags: ['API Keys'], summary: 'Revoke an API key', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 204: { description: 'Revoked' }, 401: commonResponses[401], 404: commonResponses[404] } },
    },

    '/programmatic/profile': {
      get: { tags: ['Programmatic'], summary: 'Profile via API key (scope profile:read)', security: apiKey, responses: { 200: jsonResponse('User', { type: 'object', properties: { user: ref('User') } }), 401: commonResponses[401], 403: commonResponses[403] } },
    },
    '/programmatic/sessions': {
      get: { tags: ['Programmatic'], summary: 'Sessions via API key (scope sessions:read)', security: apiKey, responses: { 200: jsonResponse('Sessions', { type: 'object', properties: { sessions: { type: 'array', items: ref('Session') } } }), 403: commonResponses[403] } },
    },

    '/audit-logs': {
      get: { tags: ['Audit'], summary: 'Read your own audit history', security: bearer, parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'cursor', in: 'query', schema: { type: 'string' } }], responses: { 200: jsonResponse('Audit page', { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } }, nextCursor: { type: 'string', nullable: true } } }), 401: commonResponses[401] } },
    },

    '/admin/stats': {
      get: { tags: ['Admin'], summary: 'Dashboard statistics', security: bearer, description: 'Requires the users:read permission.', responses: { 200: jsonResponse('Stats', { type: 'object' }), 403: commonResponses[403] } },
    },
    '/admin/users': {
      get: { tags: ['Admin'], summary: 'List/search users', security: bearer, parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'cursor', in: 'query', schema: { type: 'string' } }], responses: { 200: jsonResponse('Users page', { type: 'object' }), 403: commonResponses[403] } },
    },
    '/admin/roles': {
      get: { tags: ['Admin'], summary: 'List roles', security: bearer, responses: { 200: jsonResponse('Roles', { type: 'object' }), 403: commonResponses[403] } },
    },

    '/organizations': {
      get: { tags: ['Organizations'], summary: 'List my organizations', security: bearer, responses: { 200: jsonResponse('Organizations', { type: 'object' }), 401: commonResponses[401] } },
      post: { tags: ['Organizations'], summary: 'Create an organization', security: bearer, requestBody: jsonBody({ type: 'object', required: ['name'], properties: { name: { type: 'string' } } }), responses: { 201: jsonResponse('Created', { type: 'object' }), 401: commonResponses[401] } },
    },
  },
};
