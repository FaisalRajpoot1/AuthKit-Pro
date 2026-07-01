# Packages

Reusable libraries that let other apps integrate AuthKit Pro without
re-implementing the auth contract. Each package builds, typechecks, and tests in
isolation and emits `.d.ts` types.

| Package | Purpose | Docs |
|---|---|---|
| `@authkit/core` | Framework-agnostic client SDK | [README](../packages/core/README.md) |
| `@authkit/react` | React bindings | [README](../packages/react/README.md) |
| `@authkit/express` | Express middleware | [README](../packages/express/README.md) |
| `@authkit/cli` | Project CLI | [README](../packages/cli/README.md) |

## @authkit/core

```ts
import { AuthKit } from '@authkit/core';

const auth = new AuthKit({ baseUrl: 'https://api.example.com' });
await auth.login({ identifier: 'me@example.com', password: 'S3cret!!' });
const { user, roles, permissions } = await auth.me();
```

In-memory access-token management with a single transparent refresh-on-401.
Works in browsers, Node 18+, Deno, and Bun.

## @authkit/react

```tsx
import { AuthProvider, useAuth, ProtectedRoute } from '@authkit/react';

<AuthProvider config={{ baseUrl: 'https://api.example.com' }}>
  <App />
</AuthProvider>;

const { user, isAuthenticated, login, logout } = useAuth();
```

## @authkit/express

Protect your own service's routes with tokens issued by AuthKit:

```ts
import { createAuthMiddleware } from '@authkit/express';

const { authenticate, requirePermission } = createAuthMiddleware({
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  apiBaseUrl: 'https://api.example.com', // resolves roles/permissions via /auth/me
});

app.delete('/posts/:id', authenticate, requirePermission('posts:delete'), handler);
```

See a full runnable service in **[examples/express-api](../examples/express-api)**.

## @authkit/cli

```bash
npx @authkit/cli init            # scaffold a server .env with generated secrets
npx @authkit/cli secret          # print a random secret
```

## Notes on local development

Within this monorepo the packages reference each other via `file:` dependencies
(e.g. `@authkit/react` → `@authkit/core`). To publish them to npm you would
convert these to versioned dependencies and set up a publish workflow; the
package boundaries are already clean.
