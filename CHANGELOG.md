# Changelog

All notable changes to AuthKit Pro are documented here. The project follows a
phased development roadmap; versions are pre-1.0 while the platform stabilizes.

## [Unreleased]

### Features
- **In-app notifications** (Module 18): a notifications subsystem with a
  dashboard bell (unread badge, mark read/all, delete). Security alerts are
  emitted on password change, 2FA enable/disable, and account lockout.
- **Passkeys / WebAuthn** (Module 12): register passkeys and sign in with them
  (phishing-resistant, no password). Public keys stored, counters tracked,
  challenge bound to a signed cookie; passkey login completes without a separate
  2FA step.
- **Brute-force protection** (Module 14): failed-login tracking + temporary
  account lockout after repeated failures, with an admin unlock action and a
  login-attempts record.
- **Interactive API docs** (Module 24): OpenAPI 3 spec served as Swagger UI at
  `/api/v1/docs` and raw JSON at `/api/v1/openapi.json` (Bearer / API-key /
  cookie security schemes).
- **Passwordless login** (Modules 11–12): magic-link and email-OTP sign-in.
  Single-use, short-lived, hashed tokens; enumeration-safe; 2FA-aware.
- **API keys** (Module 19): personal keys with scopes, optional expiry, and
  revoke. The secret is shown once and hashed at rest; programmatic requests
  authenticate via `X-API-Key` and are gated per-scope (`/programmatic/*`).

### Phase 8 — Hardening & release readiness
- DB-backed **integration test suite** (PostgreSQL): auth flow, refresh rotation
  + reuse detection, 2FA (TOTP + backup codes), RBAC enforcement, organization
  invite/accept/transfer.
- CI: added a Postgres-service integration job and a job that builds/tests all
  `@authkit/*` packages and the example.
- JWT algorithm pinning and other security hardening; added `SECURITY.md`.
- Production startup guard: refuses to boot with weak/default secrets, identical
  JWT secrets, or `COOKIE_SECURE=false` when `NODE_ENV=production`.

### Phase 7 — SDK, packages, CLI, docs
- `@authkit/core` — framework-agnostic client SDK with refresh-on-401.
- `@authkit/react` — `AuthProvider`, `useAuth`, `useUser`, `ProtectedRoute`.
- `@authkit/express` — `authenticate`, `requireRole`, `requirePermission`.
- `@authkit/cli` — `authkit init` scaffolds `.env` with generated secrets.
- Documentation set (`docs/`) and a runnable `examples/express-api`.

### Phase 6 — Dashboards
- Admin dashboard: stats, user management (activate/deactivate, roles), all-users
  audit log, organizations list — permission-gated tabs.
- User account settings: edit profile, change password, change email.

### Phase 5 — RBAC, organizations & teams
- Roles + granular `resource:action` permissions; seeded system roles;
  `requireRole` / `requirePermission` middleware; admin management API.
- Organizations, members, email invites, teams, ownership transfer.

### Phase 4 — 2FA & OAuth
- TOTP two-factor auth with encrypted secrets, backup codes, trusted devices,
  and a login challenge flow.
- OAuth sign-in and account linking (Google, GitHub) with CSRF-protected state.

### Phase 3 — Sessions, devices & audit logs
- First-class device sessions with rotation reuse detection and sliding expiry;
  session management dashboard; append-only audit log.

### Phase 2 — Verification, reset & account management
- Email verification, password reset, change password/email, delete account,
  username/email availability. Pluggable email transport.

### Phase 1 — Core authentication
- Register, login, logout, `GET /me`; JWT access tokens + rotating refresh
  tokens; Argon2id hashing; Zod validation; Helmet, CORS, rate limiting.
- Docker Compose, Dockerfiles, and GitHub Actions CI.
