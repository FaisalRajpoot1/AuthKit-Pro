# Example — Express API protected by @authkit/express

A minimal third-party service that trusts access tokens issued by an AuthKit Pro
server. It verifies tokens locally and resolves roles/permissions by calling the
AuthKit `/auth/me` endpoint.

## Run

```bash
# 1. Start the AuthKit server (in ../../server) on :4000

# 2. Start this example
cd examples/express-api
npm install
# Use the SAME JWT_ACCESS_SECRET as the AuthKit server:
JWT_ACCESS_SECRET=<server secret> AUTHKIT_API_URL=http://localhost:4000 npm run dev
```

## Try it

Obtain an access token by logging in to the AuthKit server, then:

```bash
# Public
curl http://localhost:5050/health

# Authenticated
curl http://localhost:5050/whoami -H "Authorization: Bearer <ACCESS_TOKEN>"

# Permission-guarded (needs audit_logs:read)
curl http://localhost:5050/reports -H "Authorization: Bearer <ACCESS_TOKEN>"

# Role-guarded (needs the admin role)
curl http://localhost:5050/admin/ping -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Requests without a valid token get `401`; without the required permission/role,
`403` — both as `{ "error": { "code", "message" } }`.

## What this demonstrates

- `authenticate` — verifies the AuthKit access token (HS256, shared secret)
- `requirePermission('audit_logs:read')` / `requireRole('admin')` — authorization
  resolved from the AuthKit server
- `getAuth(req)` — the authenticated principal
- `authErrorHandler` — consistent JSON error responses
