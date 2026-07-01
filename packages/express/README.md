# @authkit/express

Express middleware for **AuthKit Pro**: verify access tokens and enforce roles
and permissions on your own API routes.

## Install

```bash
npm install @authkit/express express
```

## Usage

```ts
import express from 'express';
import { createAuthMiddleware, authErrorHandler, getAuth } from '@authkit/express';

const { authenticate, requireRole, requirePermission, authorize } = createAuthMiddleware({
  accessSecret: process.env.JWT_ACCESS_SECRET!, // same secret the AuthKit server signs with
  // Resolve roles/permissions either by calling the AuthKit API…
  apiBaseUrl: 'https://api.example.com',
  // …or with your own resolver:
  // resolveAuthz: async ({ principal, token }) => ({ roles: [...], permissions: [...] }),
});

const app = express();

app.get('/me', authenticate, (req, res) => {
  res.json({ userId: getAuth(req)!.userId });
});

app.get('/admin', authenticate, requireRole('admin'), handler);
app.delete('/posts/:id', authenticate, requirePermission('posts:delete'), handler);

// Custom rule
app.post('/x', authenticate, authorize((authz) => authz.permissions.includes('x:write')), handler);

// Render AuthErrors as JSON (optional)
app.use(authErrorHandler);
```

## API

### `createAuthMiddleware(config)`
Returns `{ authenticate, requireRole, requirePermission, authorize }`.

| Config | Description |
|---|---|
| `accessSecret` | HS256 secret matching the server's `JWT_ACCESS_SECRET` |
| `issuer` / `audience` | Defaults `authkit` / `authkit-client` |
| `resolveAuthz(ctx)` | Return `{ roles, permissions }` for a request |
| `apiBaseUrl` | Used by the built-in resolver (`GET /auth/me`) |
| `apiPrefix` | Defaults `/api/v1` |
| `fetch` | Custom fetch for the default resolver |

`authenticate` verifies the `Bearer` token and attaches the principal (read it
with `getAuth(req)`). `requireRole` / `requirePermission` / `authorize` resolve
authorization via `resolveAuthz` or `apiBaseUrl`.

### `getAuth(req)`
Returns `{ userId, email, sessionId }` for an authenticated request.

### `authErrorHandler`
Express error handler that renders `AuthError`s as
`{ error: { code, message } }`.

## Build from source

```bash
npm install
npm test       # vitest (mock req/res/next)
npm run build  # emits dist/ with .d.ts types
```
