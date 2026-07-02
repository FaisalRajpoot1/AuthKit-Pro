# Changelog

All notable changes to AuthKit Pro are documented here. The project follows a
phased development roadmap; versions are pre-1.0 while the platform stabilizes.

## [Unreleased]

### Features
- **SMS OTP as a 2FA factor** (Module 5): register and verify a phone number,
  then receive one-time sign-in codes by SMS during the 2FA challenge — an
  alternative to the authenticator, backup codes, or email OTP. Pluggable SMS
  transport (Twilio via REST when configured, console otherwise); phones are
  usable only after verification, and codes are single-use, expiring, and
  attempt-capped. 2FA status now reports the masked verified phone.
- **PKCE + X (Twitter) OAuth** (Module 4): the OAuth flow now supports PKCE
  (S256) per provider — a code verifier is minted, carried inside the signed
  state token, and its challenge sent in the authorization URL. Added X/Twitter
  (OAuth2 + PKCE, Basic-auth token exchange). X's v2 API exposes no email, so it
  links to an existing account rather than creating one. Shipped providers: seven
  (Apple still pending its form-post/JWT-secret flow).
- **Background email jobs** (Module 20): when `REDIS_URL` is set, transactional
  emails (verification, reset, magic link, OTP, invites) are queued to BullMQ and
  sent by a background worker off the request path, with retries and exponential
  backoff. Without Redis — or if enqueue fails — email is sent inline, so the
  default and test behavior is unchanged. The worker starts at boot and drains on
  graceful shutdown.
- **Redis-backed rate limiting** (Module 20): when `REDIS_URL` is set, rate
  limits are stored in Redis so they hold across multiple server instances; the
  store fails open (allows the request, logs a warning) if Redis is briefly
  unreachable. With no `REDIS_URL` the limiter keeps its in-process memory store,
  so single-instance and test setups are unchanged. Adds a resilient shared Redis
  client (lazy, best-effort) reused by future background jobs.
- **More OAuth providers** (Module 4): added Facebook Login and "Sign in with
  LinkedIn" (OpenID Connect), bringing the shipped set to six (Google, GitHub,
  Microsoft, Discord, Facebook, LinkedIn) via the pluggable provider strategy.
- **IP blocking** (Module 14): admins can block and unblock IP addresses
  (permanent or auto-expiring) via `/api/v1/admin/blocked-ips`; an early guard
  rejects requests from blocked IPs (403). The active set is cached in-process
  (10s TTL, invalidated on change) and fails open on lookup errors. New
  `ip_blocks:read` / `ip_blocks:manage` permissions.
- **CAPTCHA support** (Module 14): pluggable, provider-agnostic bot protection
  (Cloudflare Turnstile / hCaptcha / reCAPTCHA) on register, login, forgot, and
  passwordless-request. Off by default; no-op when disabled; fails open on
  provider outage. Token via `X-Captcha-Token`.
- **Breached-password check** (Module 14): passwords are checked against Have I
  Been Pwned (k-anonymity — only a 5-char SHA-1 prefix is sent) on register,
  password reset, and password change; breached passwords are rejected. Fails
  open on outage; toggle with `HIBP_ENABLED`.
- **Email OTP as a 2FA factor** (Module 5): during the 2FA challenge, users can
  request a one-time code by email as an alternative to their authenticator or
  backup codes (single-use, expiring, attempt-capped).
- **More OAuth providers** (Module 4): added Microsoft and Discord sign-in
  (alongside Google and GitHub), via the existing pluggable provider strategy.
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
