# Architecture

## Overview

```
┌────────────┐   access token (Bearer)   ┌─────────────────────────┐
│  client/   │ ────────────────────────► │        server/          │
│  React SPA │                           │  Express + Prisma       │
│            │ ◄──── refresh cookie ───► │  PostgreSQL + (Redis)   │
└────────────┘   httpOnly, rotating      └─────────────────────────┘
       ▲                                            ▲
       │ uses                                       │ verify tokens
┌──────┴───────┐                          ┌─────────┴──────────┐
│ @authkit/react│  builds on  @authkit/core │  @authkit/express  │
└──────────────┘                          └────────────────────┘
```

The **server** is the source of truth. The SPA and any third-party service hold
only short-lived access tokens; the long-lived refresh token is an httpOnly
cookie the browser sends automatically.

## Backend design

Feature-first modules under `server/src/features/*`, each owning its routes,
controller, service, schema, and types. Cross-cutting concerns live in
`middleware/` (auth, RBAC, validation, rate limiting, errors) and `lib/`
(prisma, jwt, password, tokens, email, encryption, device, geo).

Requests flow: **route → validate (Zod) → auth guard → permission guard →
controller → service → Prisma**. Errors are thrown as typed `AppError`s and
rendered consistently by a central handler with stable machine-readable codes.

## Token & session model

- **Access token** — short-lived JWT (`sub`, `email`, `sid`) sent as a Bearer
  header. Carries the session id so the current device is identifiable.
- **Refresh token** — opaque, hashed at rest, delivered as an httpOnly cookie.
  Rotated on every use; presenting an already-rotated token (reuse) revokes the
  whole **session**.
- **Session** — one per login/device, with parsed device metadata. Sliding
  expiry on refresh. Users can list and revoke sessions.

## Security highlights

- Argon2id password hashing; timing-safe login (enumeration-resistant).
- Refresh-token rotation with reuse detection.
- 2FA (TOTP) with the secret **encrypted at rest** (AES-256-GCM); single-use
  hashed backup codes; trusted devices.
- OAuth with a signed, httpOnly **state cookie** for CSRF protection.
- Helmet, credentialed CORS, per-route rate limiting, input/output validation.
- Append-only **audit log** of every significant action.

## Authorization (RBAC)

Roles group granular `resource:action` permissions. `requireRole` and
`requirePermission` middleware resolve a user's effective permissions per
request. Organizations add a second, tenant-scoped role hierarchy
(`OWNER > ADMIN > MEMBER`) enforced by `requireMembership`.

## Packages

The reusable libraries mirror the server contract so apps don't re-implement it:

- **@authkit/core** — the client SDK (token management + refresh-on-401).
- **@authkit/react** — `AuthProvider` / `useAuth` / `ProtectedRoute` on top of core.
- **@authkit/express** — verify tokens + guard routes in any Express service.
- **@authkit/cli** — scaffold `.env` and secrets.

See **[packages.md](packages.md)**.
