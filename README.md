# AuthKit Pro

> **Production-Ready Authentication & Authorization System** for MERN + PostgreSQL

A complete, reusable authentication infrastructure that other developers can drop into nearly any Node.js application — not just login/signup, but a solution to *every* authentication problem.

## Repository Structure

```
AuthKit_Pro/
├── client/                 # React + Vite + TypeScript frontend
├── server/                 # Express + Prisma + PostgreSQL backend
├── reqs.md                 # Full product requirements
└── MASTER_PROJECT_GUIDE.md # Engineering standards & workflow
```

- **[client/](client/)** — Frontend application (React, Vite, Redux Toolkit, React Query, Tailwind, Shadcn UI).
- **[server/](server/)** — Backend API (Node.js, Express, Prisma, PostgreSQL, Redis, JWT).

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
typecheck, tests, and build for both workspaces on every push and pull request.

## License

TBD
