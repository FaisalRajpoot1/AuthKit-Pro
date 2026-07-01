# AuthKit Pro — Documentation

Production-ready authentication & authorization for MERN + PostgreSQL.

## Contents

- **[Getting Started](getting-started.md)** — run the full stack locally
- **[Database Setup](DATABASE_SETUP.md)** — detailed PostgreSQL setup (Windows)
- **[Architecture](architecture.md)** — how the system fits together, auth flows
- **[Packages](packages.md)** — the reusable `@authkit/*` npm packages
- **[Deployment](deployment.md)** — Docker, environment, production notes
- **API reference** — see the endpoint table in [server/README.md](../server/README.md)

## Repository layout

```
AuthKit_Pro/
├── client/      React + Vite + TypeScript frontend
├── server/      Express + Prisma + PostgreSQL API
├── packages/    Reusable libraries
│   ├── core/       @authkit/core     — framework-agnostic SDK
│   ├── react/      @authkit/react    — React bindings
│   ├── express/    @authkit/express  — Express middleware
│   └── cli/        @authkit/cli      — project CLI
├── examples/    Ready-to-run integrations
│   └── express-api/  Third-party API protected by @authkit/express
├── docs/        You are here
└── docker-compose.yml
```

## Feature overview

| Area | What's included |
|---|---|
| **Auth** | Register, login, logout, email verification, password reset |
| **Tokens** | JWT access + rotating refresh (reuse detection), sliding sessions |
| **Sessions** | Device sessions dashboard, revoke one / all, audit trail |
| **2FA** | TOTP authenticator, backup codes, trusted devices |
| **OAuth** | Google + GitHub sign-in and account linking |
| **RBAC** | Roles + granular `resource:action` permissions, admin management |
| **Orgs** | Organizations, members, invites, teams, ownership transfer |
| **Dashboards** | Admin (users/roles/audit/orgs) + user account settings |
| **Packages** | SDK, React bindings, Express middleware, CLI |
| **DevOps** | Docker Compose, Dockerfiles, GitHub Actions CI |
