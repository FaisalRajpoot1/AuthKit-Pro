# @authkit/react

React bindings for **AuthKit Pro**, built on [`@authkit/core`](../core). Provides
an `AuthProvider`, the `useAuth` / `useUser` hooks, and a `ProtectedRoute`.

## Install

```bash
npm install @authkit/react @authkit/core react react-dom
```

## Usage

```tsx
import { AuthProvider, useAuth, ProtectedRoute } from '@authkit/react';

function Root() {
  return (
    <AuthProvider config={{ baseUrl: 'https://api.example.com' }}>
      <App />
    </AuthProvider>
  );
}

function LoginButton() {
  const { login, isAuthenticated, user } = useAuth();
  if (isAuthenticated) return <p>Hi {user?.username}</p>;
  return (
    <button onClick={() => login({ identifier: 'me@example.com', password: 'S3cret!!' })}>
      Sign in
    </button>
  );
}

// Guard a subtree; pass a redirect as `fallback`
function Private() {
  return (
    <ProtectedRoute fallback={<Navigate to="/login" replace />} loading={<Spinner />}>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

The provider restores the session on mount (via the SDK's cookie-based refresh),
so `status` transitions `loading → authenticated | unauthenticated`.

## API

### `<AuthProvider config={...}>` or `<AuthProvider client={authKitInstance}>`
Supplies auth state to the tree. Pass a `config` (an `AuthKitConfig`) or a
pre-built `AuthKit` client.

### `useAuth()`
Returns `{ status, user, roles, permissions, isAuthenticated, hasPermission,
hasRole, login, completeTwoFactor, register, logout, refresh, client }`.

### `useUser()`
Shorthand for `useAuth().user`.

### `<ProtectedRoute fallback loading>`
Renders `children` only when authenticated; `loading` while restoring and
`fallback` when unauthenticated.

This package re-exports `AuthKit`, `AuthKitError`, and the core types for
convenience.

## Build from source

```bash
npm install
npm test       # vitest + @testing-library/react (jsdom)
npm run build  # emits dist/ with .d.ts types
```
