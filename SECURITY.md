# Security Policy

AuthKit Pro is authentication infrastructure, so security is a first-class
concern. This document describes the security model, the practices the codebase
follows, and how to report a vulnerability.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report
privately to the maintainers (e.g. via a GitHub security advisory on the
repository). Include reproduction steps and impact. We aim to acknowledge
reports promptly and coordinate a fix and disclosure.

## Security model

### Passwords
- Hashed with **Argon2id** (OWASP-recommended parameters: 19 MiB memory,
  time cost 2). Never logged or returned by the API.
- Strength enforced at registration (length + character classes) via Zod.
- Login is **timing-safe** and **enumeration-resistant**: a verification is
  always performed against a real dummy hash when the account doesn't exist, so
  response time doesn't reveal whether an email is registered.

### Tokens & sessions
- **Access tokens** — short-lived JWTs (HS256), pinned to `issuer`/`audience`
  and a fixed algorithm allowlist; carry `sub`, `email`, and the session id.
- **Refresh tokens** — opaque, high-entropy random strings; only their SHA-256
  hash is stored, so a database leak does not expose usable tokens.
- **Rotation + reuse detection** — every refresh rotates the token; presenting
  an already-rotated token (theft indicator) revokes the entire session.
- **Sessions** are first-class, per-device, with sliding expiry; users can
  revoke individual sessions or all others.
- Short-lived, audience-scoped JWTs are also used for the **2FA challenge** and
  the **OAuth state** (CSRF) so they can never be replayed as access tokens.

### Cookies
- The refresh token is delivered as an **httpOnly, SameSite** cookie scoped to
  the auth path — not readable by JavaScript (XSS-resistant) and not sent on
  cross-site sub-requests (CSRF-resistant). `Secure` is enabled in production.
- All other state-changing endpoints authenticate via the `Authorization`
  header (not cookies), so they are inherently immune to CSRF.

### Two-factor authentication
- TOTP secrets are **encrypted at rest** with AES-256-GCM (authenticated
  encryption; the key lives only in the environment).
- Backup codes are single-use and stored hashed; a used code cannot be replayed.
- Trusted-device tokens are hashed at rest and expire.

### OAuth
- Authorization-code flow with a **signed, httpOnly state cookie** verified on
  callback (CSRF protection). Accounts are linked to an existing user only by a
  **verified** email; otherwise a fresh account is created.

### Authorization
- Role-based access control with granular `resource:action` permissions,
  resolved per request. Organization actions are enforced by a membership +
  role-hierarchy check (`OWNER > ADMIN > MEMBER`).

### Transport & platform hardening
- **Helmet** security headers, **credentialed CORS** restricted to configured
  origins, and **rate limiting** on sensitive auth endpoints.
- Request bodies validated and size-limited (Zod + a 10 kB JSON cap).
- SQL access is via **Prisma** (parameterized); no user input is interpolated
  into raw SQL.
- Centralized error handling returns stable error codes and never leaks
  internal details or stack traces in production.
- Secrets are provided via environment variables and validated at startup; logs
  redact `Authorization`, cookies, and password fields.
- An append-only **audit log** records every significant action.

## Deploying securely

See [docs/deployment.md](docs/deployment.md). In production you must:

- Serve over HTTPS and set `COOKIE_SECURE=true`, `NODE_ENV=production`.
- Use strong, unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and a base64
  32-byte `ENCRYPTION_KEY` from a secret manager (never the dev values).
- Restrict `CORS_ORIGINS` to your real frontend origin(s).
- Configure real SMTP so verification/reset emails are delivered.

## Known limitations / roadmap

- Rate limiting is per-IP (in-memory); a distributed store (Redis) and
  account-level lockout / breached-password checks (HaveIBeenPwned) are planned.
- Cross-site cookie deployments (API and app on different domains) require
  `SameSite=None; Secure`; the default is `Lax` for same-site/proxied setups.
