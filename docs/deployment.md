# Deployment

## Docker Compose (self-hosted)

The repository ships a full stack: Postgres, Redis, the API, and the nginx-served
client.

```bash
cp .env.example .env         # set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
docker compose up --build -d
```

- The API image runs pending Prisma migrations on startup (`migrate deploy`).
- The client is built and served by nginx, which proxies `/api` to the server.
- Postgres and Redis use named volumes for persistence.

## Environment

The server validates its environment at boot (fails fast on misconfiguration).
Required in production:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥32 chars each |
| `ENCRYPTION_KEY` | base64-encoded 32 bytes (2FA secret encryption) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `APP_URL` | Public frontend URL (email links) |
| `SERVER_PUBLIC_URL` | Public API URL (OAuth redirect URIs) |

See [server/.env.example](../server/.env.example) for the full list, including
email (SMTP), OAuth provider credentials, and token lifetimes.

## Production checklist

- [ ] Set `NODE_ENV=production` and `COOKIE_SECURE=true` (serve over HTTPS).
- [ ] Provide strong, unique `JWT_*` and `ENCRYPTION_KEY` values from a secret
      manager — never reuse the development ones.
- [ ] Configure real SMTP (`SMTP_HOST`, …) so verification/reset/invite emails
      are delivered.
- [ ] Register OAuth apps and set the provider client id/secret; the redirect
      URI is `${SERVER_PUBLIC_URL}/api/v1/auth/oauth/{provider}/callback`.
- [ ] Run behind a reverse proxy/TLS terminator; the app trusts one proxy hop
      (`trust proxy`) for correct client IPs and secure cookies.
- [ ] Back up PostgreSQL; keep migrations in version control (they are committed
      under `server/prisma/migrations`).
- [ ] Review the CI workflow ([.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## Platform notes

- **Railway / Render**: deploy the `server/` Dockerfile; set env vars; attach a
  managed Postgres. Point the client build's API base at the API URL.
- **Vercel / Netlify** (client): build `client/` and set the API origin;
  ensure CORS `credentials` and cookie `SameSite`/domain are configured for
  cross-site if the API is on a different domain.
