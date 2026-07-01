# Contributing

AuthKit Pro is proprietary software (see [LICENSE](LICENSE)). This guide is for
authorized contributors working on the codebase.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Git

## Project layout

- `server/` — Express + Prisma API
- `client/` — React + Vite frontend
- `packages/` — reusable `@authkit/*` libraries (core, react, express, cli)
- `examples/` — runnable integrations
- `docs/` — documentation

See [docs/getting-started.md](docs/getting-started.md) to run the stack and
[docs/architecture.md](docs/architecture.md) for the design.

## Local setup

```bash
# Backend
cd server
npx @authkit/cli init      # or copy .env.example and fill it in
#   set DATABASE_URL, then:
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev

# Frontend
cd client && npm install && npm run dev
```

## Standards

The engineering standards are defined in
[MASTER_PROJECT_GUIDE.md](MASTER_PROJECT_GUIDE.md). In short:

- **TypeScript strict**, no `any`, small focused functions, meaningful names.
- Validate input with **Zod** at the edge; return typed errors with stable codes.
- Feature-first structure on the server (`features/<name>/*`).
- Security first: never log secrets; hash/encrypt sensitive data; guard routes
  with `requireAuth` / `requirePermission`.

## Before you push

Run the checks for whatever you touched:

```bash
# server
cd server && npm run lint && npm run typecheck && npm test && npm run build
# integration tests (needs a test database named with "test")
DATABASE_URL="postgresql://.../authkit_test?schema=public" npm run test:integration

# client
cd client && npm run lint && npm run typecheck && npm run build

# a package
cd packages/<name> && npm run lint && npm test && npm run build
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the same checks,
including a Postgres-backed integration job, on every push and PR.

## Git conventions

- Work on feature branches; open a pull request against `main`.
- Use **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `security:`), matching the existing history.
- Keep commits focused; update docs, `CHANGELOG.md`, and tests alongside code.

## Database changes

- Edit `server/prisma/schema.prisma`, then create a migration:
  ```bash
  cd server && npm run prisma:migrate   # prompts for a migration name
  ```
- Commit the generated files under `server/prisma/migrations/`.

## Security

Report vulnerabilities privately per [SECURITY.md](SECURITY.md) — do not open a
public issue.
