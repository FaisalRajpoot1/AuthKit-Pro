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
| `GET`  | `/api/v1/health/live` | — | Liveness |
| `GET`  | `/api/v1/health/ready` | — | Readiness (DB check) |

The access token is returned in the JSON body; the refresh token is set as an
httpOnly, SameSite cookie scoped to `/api/v1/auth`.
