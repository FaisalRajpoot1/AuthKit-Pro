# @authkit/core

Framework-agnostic TypeScript client SDK for **AuthKit Pro**. Wraps the REST API
with in-memory access-token management and transparent refresh-on-401. Works in
any environment with `fetch` (browsers, Node 18+, Deno, Bun).

## Install

```bash
npm install @authkit/core
```

## Usage

```ts
import { AuthKit, AuthKitError } from '@authkit/core';

const auth = new AuthKit({
  baseUrl: 'https://api.example.com', // or '' for same-origin
  // credentials: true (default) sends the httpOnly refresh cookie
  onAccessTokenChange: (token) => console.log('token changed', token),
});

// Register or log in
await auth.register({ email: 'me@example.com', username: 'me', password: 'S3cret!!' });

const result = await auth.login({ identifier: 'me@example.com', password: 'S3cret!!' });
if (result.status === 'two_factor_required') {
  await auth.completeTwoFactor({ challengeToken: result.challengeToken, code: '123456' });
}

// Authenticated calls auto-attach the bearer token and refresh on 401
const { user, roles, permissions } = await auth.me();

await auth.logout();
```

### Error handling

Every non-2xx response throws an `AuthKitError` with the HTTP `status` and the
server's stable `code`:

```ts
try {
  await auth.login({ identifier: 'me', password: 'wrong' });
} catch (err) {
  if (err instanceof AuthKitError && err.isUnauthorized) {
    // err.code === 'UNAUTHORIZED'
  }
}
```

## API

| Method | Description |
|---|---|
| `register(input)` | Create an account; stores the access token |
| `login(input)` | Authenticate; returns `authenticated` or `two_factor_required` |
| `completeTwoFactor(input)` | Finish a 2FA login |
| `me()` | Current user + roles + permissions (authenticated) |
| `refresh()` | Exchange the refresh cookie for a new access token |
| `logout()` | Revoke the session and clear the token |
| `verifyEmail(token)` | Verify an email address |
| `forgotPassword(email)` | Request a reset link |
| `resetPassword(token, password)` | Complete a reset |

Properties: `accessToken`, `isAuthenticated`.

## Config

| Option | Default | Description |
|---|---|---|
| `baseUrl` | — | API origin |
| `apiPrefix` | `/api/v1` | Path prefix |
| `credentials` | `true` | Send cookies (needed for refresh) |
| `fetch` | global `fetch` | Custom fetch implementation |
| `onAccessTokenChange` | — | Callback when the token changes |

## Build from source

```bash
npm install
npm test       # vitest (mocked fetch)
npm run build  # emits dist/ with .d.ts types
```
