# AuthKit Pro

> **Production-Ready Authentication & Authorization System** for MERN + PostgreSQL

A complete, reusable authentication infrastructure that other developers can drop into nearly any Node.js application — not just login/signup, but a solution to *every* authentication problem.

## Repository Structure

```
AuthKit_Pro/
├── client/                 # React + Vite + TypeScript frontend
├── server/                 # Express + Prisma + PostgreSQL backend
├── packages/               # Reusable @authkit/* libraries
│   ├── core/               # @authkit/core     — framework-agnostic SDK
│   ├── react/              # @authkit/react    — React bindings
│   ├── express/            # @authkit/express  — Express middleware
│   └── cli/                # @authkit/cli      — project CLI
├── examples/               # Ready-to-run integrations
│   └── express-api/        # Third-party API protected by @authkit/express
├── docs/                   # Documentation
├── reqs.md                 # Full product requirements
└── MASTER_PROJECT_GUIDE.md # Engineering standards & workflow
```

- **[client/](client/)** — Frontend application (React, Vite, React Query, Tailwind).
- **[server/](server/)** — Backend API (Node.js, Express, Prisma, PostgreSQL, JWT).
- **[packages/](packages/)** — Publishable SDK, React bindings, Express middleware, and CLI.
- **[examples/](examples/)** — Runnable integrations of the packages.

## Documentation

Full docs live in **[docs/](docs/)**:
[Getting Started](docs/getting-started.md) ·
[Database Setup](docs/DATABASE_SETUP.md) ·
[Architecture](docs/architecture.md) ·
[Packages](docs/packages.md) ·
[Deployment](docs/deployment.md).

See **[reqs.md](reqs.md)** for the full feature specification and **[MASTER_PROJECT_GUIDE.md](MASTER_PROJECT_GUIDE.md)** for the engineering standards we build against.

## Tech Stack

**Backend:** Node.js · Express · PostgreSQL · Prisma · Redis · JWT · Passport · Zod · BullMQ · Docker
**Frontend:** React · Vite · TypeScript · Redux Toolkit · React Query · Tailwind CSS · Shadcn UI
**DevOps:** Docker · Docker Compose · GitHub Actions · Nginx

## Getting Started

### Option A — Docker (everything in one command)

```bash
cp .env.example .env     # set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
docker compose up --build
```

- Client → http://localhost:8080
- API → http://localhost:4000/api/v1
- The server applies pending Prisma migrations on startup.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Option B — Run workspaces locally (infra in Docker)

```bash
docker compose up -d db redis     # Postgres + Redis only
# server
cd server && cp .env.example .env && npm install && npm run prisma:migrate && npm run dev
# client (new terminal)
cd client && npm install && npm run dev
```

See **[server/README.md](server/README.md)** and **[client/README.md](client/README.md)** for details.

## Continuous Integration

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint,
typecheck, unit tests, a **Postgres-backed integration suite**, and builds for
the server, client, and all `@authkit/*` packages on every push and pull request.

## Contributing & Security

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local setup, standards, and workflow.
- **[SECURITY.md](SECURITY.md)** — security model and how to report a vulnerability.

## License

Proprietary — All Rights Reserved. See **[LICENSE](LICENSE)**.
