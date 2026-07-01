# Getting Started

Run the full AuthKit Pro stack locally.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (running locally, or via Docker)

## Option A — Docker (one command)

```bash
cp .env.example .env      # then set JWT + ENCRYPTION secrets (see below)
docker compose up --build
```

- Client → http://localhost:8080
- API → http://localhost:4000/api/v1

The server applies migrations on startup. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" # JWT_* (x2)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"    # ENCRYPTION_KEY
```

## Option B — Run workspaces locally

### 1. Backend

```bash
cd server

# Scaffold .env with generated secrets (or copy .env.example and fill it in)
npx @authkit/cli init            # writes server/.env with fresh secrets
# ...then set DATABASE_URL in server/.env

npm install
npm run prisma:migrate           # create tables
npm run prisma:seed              # roles & permissions
npm run dev                      # http://localhost:4000
```

For a step-by-step PostgreSQL walkthrough (Windows), see
**[Database Setup](DATABASE_SETUP.md)**.

### 2. Frontend

```bash
cd client
npm install
npm run dev                      # http://localhost:5173
```

## First run

1. Open http://localhost:5173 and register.
2. Verification / reset / invite **email links print to the server console**
   (SMTP is off by default) — copy them from there.
3. To access the **admin dashboard**, grant your account the `admin` role
   (see [Database Setup](DATABASE_SETUP.md) → "Make yourself an admin").

## Running the tests

```bash
cd server && npm test     # backend (Vitest)
cd client && npm run build # frontend typecheck + build
```

Each package under `packages/` also has its own `npm test`.
