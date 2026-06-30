# AuthKit Pro — Client

React + Vite + TypeScript frontend for AuthKit Pro.

**Stack:** React 18 · Vite · TypeScript (strict) · React Router · React Hook Form · Zod · Axios · TanStack Query · Tailwind CSS

## Architecture

```
src/
├── components/    # ProtectedRoute, shared UI primitives
├── features/
│   └── auth/      # AuthContext/useAuth, auth.api, types + zod schemas
├── lib/           # axios client (refresh-on-401), error helpers
├── pages/         # Login, Register, Dashboard
├── App.tsx        # route table
└── main.tsx       # providers (Query, Router, Auth)
```

## Phase 1 — implemented

- Login / Register / Dashboard pages with React Hook Form + Zod validation
- `AuthProvider` / `useAuth` session context; session restored on load via the
  refresh cookie
- Axios client keeps the access token **in memory** (XSS-resistant) and
  transparently refreshes on `401`, replaying the original request
- `ProtectedRoute` guard with initializing state

## Getting started

The Vite dev server proxies `/api` to the backend at `http://localhost:4000`,
so run the server first.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
