# @authkit/cli

Command-line helper for **AuthKit Pro**. Scaffolds a server `.env` with freshly
generated secrets and prints the setup steps. Zero runtime dependencies.

## Usage

```bash
# In your server directory:
npx @authkit/cli init

# Options
npx @authkit/cli init --database-url "postgresql://user:pass@localhost:5432/authkit?schema=public"
npx @authkit/cli init --force            # overwrite an existing .env
npx @authkit/cli init --cwd ./server

# Generate a single secret
npx @authkit/cli secret            # 48 bytes, base64url
npx @authkit/cli secret --bytes 32
```

`init` writes a `.env` containing:

- **JWT_ACCESS_SECRET / JWT_REFRESH_SECRET** — random 48-byte base64url secrets
- **ENCRYPTION_KEY** — a base64-encoded 32-byte AES-256-GCM key (for 2FA)
- **DATABASE_URL** — the value you passed, or a localhost placeholder
- Sensible development defaults for cookies, email (console transport), TTLs,
  and optional OAuth slots

It refuses to overwrite an existing `.env` unless `--force` is given.

## Commands

| Command | Description |
|---|---|
| `authkit init` | Scaffold a `.env` with generated secrets |
| `authkit secret [--bytes N]` | Print a single random secret |
| `authkit version` | Print the version |
| `authkit help` | Show usage |

## Programmatic API

The generation logic is also exported for use in scripts:

```ts
import { generateSecrets, buildEnvFile, runInit } from '@authkit/cli';
```

## Build from source

```bash
npm install
npm test       # vitest (temp-dir scaffolding)
npm run build  # emits dist/ (bin: dist/cli.js)
```
