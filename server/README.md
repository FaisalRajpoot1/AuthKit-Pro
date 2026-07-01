# AuthKit Pro — Server

Express + Prisma + PostgreSQL backend for AuthKit Pro.

**Stack:** Node.js · Express · TypeScript (strict) · PostgreSQL · Prisma · Argon2 · JWT · Zod · Pino · Helmet · express-rate-limit

## Architecture

Feature-first layout — each feature owns its routes, controller, service, schema, and types.

```
src/
├── config/        # env validation (Zod), constants
├── lib/           # prisma client, logger, jwt, password (argon2), tokens
├── middleware/    # error handler, auth guard, validation, rate limiting
├── features/
│   ├── auth/      # register, login, refresh, logout, me
│   └── health/    # liveness/readiness probes
├── routes/        # versioned API router (/api/v1)
├── utils/         # AppError hierarchy, asyncHandler
├── app.ts         # Express app factory (no side effects)
└── server.ts      # composition root (listen + graceful shutdown)
```

## Phase 1 — implemented

- Register / Login / Logout / `GET /me`
- JWT **access tokens** (short-lived) + opaque **refresh tokens** (hashed at rest)
- Refresh-token **rotation** with **reuse detection** (whole family revoked on replay)
- Argon2id password hashing, timing-safe login, account-enumeration resistance
- Zod request validation, Helmet, CORS (credentialed), per-route rate limiting
- Centralized error handling with stable error codes
- **Brute-force protection**: failed logins are tracked; an account locks for a
  window after repeated failures (admins can unlock)
- **Breached-password check** (Have I Been Pwned, k-anonymity) on register,
  reset, and change — rejects passwords found in known breaches

## Phase 2 — implemented

- **Email verification**: token sent on registration; verify, resend, and
  email-change confirmation. Single-use hashed tokens with expiry.
- **Password reset**: forgot/reset with enumeration-safe responses; completing a
  reset revokes all active sessions.
- **Account management**: update profile, change password (keeps the current
  session, revokes the rest), change email (confirmed via the new address),
  soft-delete account, and pre-registration username/email availability check.
- **Email service**: pluggable transport — SMTP (Nodemailer) when configured,
  console logging in development.

## Phase 3 — implemented

- **Sessions**: every login creates a device `Session` (browser/OS/type parsed
  from the user-agent, IP, last-used) that owns its refresh-token rotation chain.
  List active sessions, revoke one, or "log out other devices". Refresh is
  **sliding** (extends the window). The access token carries a `sid` claim so
  the current device is identifiable.
- **Reuse detection now revokes the whole session**; change-password keeps the
  current session and kills the rest; reset/delete revoke everything.
- **Audit log**: append-only trail of every significant action (register, login,
  failed login, logout, password/email changes, session revocations, token-reuse
  detection) with IP, user-agent, and metadata. Users can read their own history
  (cursor-paginated). `location` is a seam for a geo-IP provider.

## Phase 4A — Two-Factor Authentication (TOTP)

- **Authenticator-app 2FA** (TOTP): setup returns a QR code + secret; enabling
  verifies a code and issues one-time **backup codes**. Disable requires the
  password.
- **TOTP secret is encrypted at rest** with AES-256-GCM (`ENCRYPTION_KEY`).
- **Login challenge flow**: a correct password on a 2FA account returns a
  short-lived challenge token instead of a session; `/auth/2fa/login` completes
  it with a TOTP or backup code. **Trusted devices** can skip 2FA for a window.
- Backup codes are hashed at rest and single-use; reuse of a backup code is
  impossible. All 2FA actions are audit-logged.
- **Email OTP fallback**: during the challenge, a user can request a one-time
  code by email (`/auth/2fa/email-otp/request`) as an alternative second factor —
  single-use, expiring, and attempt-capped.

## Phase 4B — OAuth (Google · GitHub · Microsoft · Discord)

- **Sign in / sign up with Google, GitHub, Microsoft, or Discord.** Existing accounts are matched by
  verified email and linked automatically; otherwise a new account is created
  (random password the user can reset later).
- **Account linking/unlinking** for signed-in users. Unlink is refused if it
  would lock the user out (no other provider and no verified email to reset a
  password). Each external identity maps to at most one user.
- **SPA-friendly flow**: the client fetches an authorization URL (which sets a
  signed, httpOnly **state cookie** for CSRF), navigates to the provider, and
  the callback sets the refresh cookie and bounces back to the app, which then
  refreshes to obtain its access token.
- Providers are a pluggable strategy (`OAuthProviderClient`); adding the other
  six providers from the spec is the same shape. A provider is active only when
  its client id/secret are configured.

## Phase 5A — RBAC & Permission System

- **Roles + granular permissions** (`resource:action`, e.g. `users:manage`).
  Six seeded **system roles** (admin · moderator · manager · editor · customer ·
  guest); admins can create custom roles and set their permissions.
- **Middleware**: `requireRole(name)` and `requirePermission('resource:action')`
  resolve a user's effective permissions per request.
- New users are granted the **default `customer` role** on registration.
- `GET /auth/me` now returns the caller's `roles` and `permissions`.
- **Seed** the catalog and system roles (idempotent):

  ```bash
  npm run prisma:seed
  ```

- All role/permission changes are audit-logged.

## Phase 5B — Organizations & Teams

- **Organizations** (Slack-style tenants): create, list, rename, delete. The
  creator becomes `OWNER`; org-scoped roles are `OWNER > ADMIN > MEMBER`.
- **Members**: invite by email (expiring, hashed token + email), accept invite,
  change role, remove, leave, and **transfer ownership** (owner → admin swap).
- **Teams** within an org: create, delete, add/remove members (`LEAD`/`MEMBER`).
- Authorization is enforced per request via `requireMembership(orgId, minRole)`.
- All organization/team actions are audit-logged.

## Phase 6A — Admin Dashboard

- **Stats overview**: total/active/verified/2FA users, new signups (7d/30d),
  organization count, active sessions.
- **User management**: paginated, searchable user list; activate/deactivate a
  user (deactivation revokes all their sessions); assign roles.
- **Audit log**: org-wide audit trail across all users, filterable, paginated.
- **Organizations**: searchable list of all organizations with owner + member
  counts.
- Every endpoint is permission-guarded (`users:read`, `users:manage`,
  `audit_logs:read`, `organizations:manage`); the client renders only the tabs
  the signed-in admin is allowed to see.

## Phase 6B — User Dashboard

- Self-service **account settings** on the user dashboard: edit display name,
  **change password** (revokes other sessions), and **change email** (confirmed
  via a link to the new address).
- Combined with the existing cards (2FA, active sessions, connected OAuth
  accounts, recent activity), the user dashboard now covers profile, password,
  2FA, sessions, and connected accounts end to end.

## Notifications

- In-app **notifications** with unread counts: list, mark read / mark all read,
  delete. **Security alerts** are raised automatically on password change, 2FA
  enable/disable, and account lockout.

## API Keys

- Personal **API keys** for programmatic access: create (secret shown once,
  SHA-256 hashed at rest), scopes, optional expiry, and revoke.
- Authenticate programmatic requests with the `X-API-Key` header; endpoints are
  gated per-scope via `requireScope`. A revoked/expired key, or a disabled user,
  is rejected immediately.
- Demonstrated by `/api/v1/programmatic/*` (profile, sessions).

## Passkeys (WebAuthn)

- Register **passkeys** (Face ID / Touch ID / Windows Hello / security keys) and
  sign in with them — phishing-resistant, no password. Public keys stored;
  private keys never leave the device. Counter is tracked to detect cloned
  authenticators.
- Ceremonies use `@simplewebauthn/server`; the challenge is bound to a signed,
  httpOnly cookie. A passkey login is strong auth and completes without a
  separate 2FA step.
- Configure `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` for your domain.

## Passwordless login

- **Magic link** and **email OTP** sign-in — no password required. Tokens are
  single-use, short-lived, hashed at rest (OTP hashes salted with the user id;
  a per-code attempt cap prevents guessing).
- Enumeration-safe requests (always the same response) and **2FA-aware**: if the
  account has 2FA enabled, verification returns a challenge instead of a session
  (shared `finalizeLogin` with password login).

## Getting started

```bash
cp .env.example .env          # then fill in DATABASE_URL and JWT secrets
npm install
npm run prisma:migrate        # create tables (requires a running PostgreSQL)
npm run dev                   # http://localhost:4000
```

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Watch-mode dev server (tsx) |
| `npm run build` / `start` | Compile to `dist/` / run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run prisma:migrate` | Apply migrations (dev) |
| `npm run prisma:studio` | Browse data |

## API (v1)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | — | Create account, issue tokens |
| `POST` | `/api/v1/auth/login` | — | Authenticate, issue tokens |
| `POST` | `/api/v1/auth/refresh` | cookie | Rotate refresh token, new access token |
| `POST` | `/api/v1/auth/logout` | cookie | Revoke refresh token |
| `GET`  | `/api/v1/auth/me` | Bearer | Current user profile |
| `POST` | `/api/v1/auth/email/verify` | — | Verify email with token |
| `POST` | `/api/v1/auth/email/confirm-change` | — | Confirm email change with token |
| `POST` | `/api/v1/auth/email/resend` | Bearer | Resend verification email |
| `POST` | `/api/v1/auth/password/forgot` | — | Request a reset link |
| `POST` | `/api/v1/auth/password/reset` | — | Reset password with token |
| `PATCH`| `/api/v1/account/profile` | Bearer | Update profile |
| `POST` | `/api/v1/account/change-password` | Bearer | Change password |
| `POST` | `/api/v1/account/change-email` | Bearer | Request email change |
| `DELETE`| `/api/v1/account` | Bearer | Soft-delete account |
| `GET`  | `/api/v1/account/availability` | — | Username/email availability |
| `GET`  | `/api/v1/sessions` | Bearer | List active device sessions |
| `DELETE`| `/api/v1/sessions` | Bearer | Log out other devices |
| `DELETE`| `/api/v1/sessions/:id` | Bearer | Revoke a specific session |
| `GET`  | `/api/v1/audit-logs` | Bearer | Read own audit history |
| `POST` | `/api/v1/auth/2fa/login` | challenge | Complete 2FA login |
| `GET`  | `/api/v1/account/2fa` | Bearer | 2FA status |
| `POST` | `/api/v1/account/2fa/setup` | Bearer | Start 2FA enrollment (QR + secret) |
| `POST` | `/api/v1/account/2fa/enable` | Bearer | Confirm code, enable, get backup codes |
| `POST` | `/api/v1/account/2fa/disable` | Bearer | Disable 2FA (password) |
| `POST` | `/api/v1/account/2fa/backup-codes` | Bearer | Regenerate backup codes |
| `GET`  | `/api/v1/auth/oauth/:provider/url` | — | Get sign-in authorization URL |
| `GET`  | `/api/v1/auth/oauth/:provider/callback` | — | Provider redirect target |
| `GET`  | `/api/v1/auth/oauth/:provider/link` | Bearer | Get link authorization URL |
| `GET`  | `/api/v1/auth/oauth/accounts` | Bearer | List linked accounts |
| `DELETE`| `/api/v1/auth/oauth/:provider` | Bearer | Unlink a provider |
| `GET`  | `/api/v1/admin/roles` | `roles:read` | List roles |
| `POST` | `/api/v1/admin/roles` | `roles:manage` | Create a role |
| `PATCH`| `/api/v1/admin/roles/:id` | `roles:manage` | Update a role |
| `DELETE`| `/api/v1/admin/roles/:id` | `roles:manage` | Delete a custom role |
| `PUT`  | `/api/v1/admin/roles/:id/permissions` | `roles:manage` | Set role permissions |
| `GET`  | `/api/v1/admin/permissions` | `permissions:read` | List permissions |
| `PUT`  | `/api/v1/admin/users/:id/roles` | `users:manage` | Assign roles to a user |
| `GET`  | `/api/v1/admin/stats` | `users:read` | Dashboard statistics |
| `GET`  | `/api/v1/admin/users` | `users:read` | List/search users (paginated) |
| `PATCH`| `/api/v1/admin/users/:id/status` | `users:manage` | Activate/deactivate a user |
| `GET`  | `/api/v1/admin/audit-logs` | `audit_logs:read` | All-users audit log |
| `GET`  | `/api/v1/admin/organizations` | `organizations:manage` | List all organizations |
| `POST` | `/api/v1/organizations` | Bearer | Create an organization |
| `GET`  | `/api/v1/organizations` | Bearer | List my organizations |
| `POST` | `/api/v1/organizations/:id/invites` | org ADMIN | Invite a member by email |
| `POST` | `/api/v1/organizations/invites/accept` | Bearer | Accept an invite |
| `POST` | `/api/v1/organizations/:id/transfer-ownership` | org OWNER | Transfer ownership |
| `GET`  | `/api/v1/organizations/:id/teams` | org member | List teams |
| `POST` | `/api/v1/organizations/:id/teams` | org ADMIN | Create a team |
| `GET`  | `/api/v1/account/api-keys` | Bearer | List API keys |
| `POST` | `/api/v1/account/api-keys` | Bearer | Create an API key (secret once) |
| `DELETE`| `/api/v1/account/api-keys/:id` | Bearer | Revoke an API key |
| `GET`  | `/api/v1/programmatic/profile` | API key `profile:read` | Profile (programmatic) |
| `GET`  | `/api/v1/programmatic/sessions` | API key `sessions:read` | Sessions (programmatic) |
| `GET`  | `/api/v1/health/live` | — | Liveness |
| `GET`  | `/api/v1/health/ready` | — | Readiness (DB check) |

The access token is returned in the JSON body; the refresh token is set as an
httpOnly, SameSite cookie scoped to `/api/v1/auth`.

## Interactive API docs (OpenAPI / Swagger)

- **Swagger UI** → `GET /api/v1/docs`
- **Raw OpenAPI spec** → `GET /api/v1/openapi.json`

Documents the core auth, account, session, 2FA, passwordless, API-key, and admin
endpoints with request/response schemas and security schemes (Bearer token, API
key, refresh cookie). Toggle with `API_DOCS_ENABLED`.
