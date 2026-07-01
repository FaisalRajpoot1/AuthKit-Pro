import { createAuthMiddleware, authErrorHandler, getAuth } from '@authkit/express';
import express from 'express';

/**
 * Example third-party service that trusts tokens issued by an AuthKit Pro
 * server. It verifies the access token locally (shared JWT secret) and resolves
 * roles/permissions by calling the AuthKit `/auth/me` endpoint.
 *
 * Run the AuthKit server first, then start this on a different port and call it
 * with an access token obtained from the AuthKit client.
 */
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-32-characters';
const AUTHKIT_API = process.env.AUTHKIT_API_URL ?? 'http://localhost:4000';
const PORT = Number(process.env.PORT ?? 5050);

const { authenticate, requireRole, requirePermission } = createAuthMiddleware({
  accessSecret: ACCESS_SECRET,
  apiBaseUrl: AUTHKIT_API, // resolves authz via GET /api/v1/auth/me
});

const app = express();
app.use(express.json());

// Public
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Requires a valid access token
app.get('/whoami', authenticate, (req, res) => {
  const principal = getAuth(req);
  res.json({ principal });
});

// Requires a specific permission (resolved from AuthKit)
app.get('/reports', authenticate, requirePermission('audit_logs:read'), (_req, res) => {
  res.json({ reports: ['login-activity', 'signups'] });
});

// Requires the admin role
app.get('/admin/ping', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ pong: true });
});

// Render AuthErrors (401/403) as JSON
app.use(authErrorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Example API listening on http://localhost:${PORT} (AuthKit: ${AUTHKIT_API})`);
});
