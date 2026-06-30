# Database Setup — Step by Step (Windows + PostgreSQL)

This guide takes you from a freshly cloned repo to a **running AuthKit Pro** with
a real PostgreSQL database, the first migration applied, and seed data loaded.

You only need to do this **once**. Follow each step in order.

---

## What you need before starting

- ✅ PostgreSQL **18** is installed and running (you have this — the Windows
  service `postgresql-x64-18` is running).
- ✅ Node.js 20+ and npm (you have Node 22).
- ✅ You know your **`postgres` user password** (the one you typed during the
  PostgreSQL installer). If you don't, see **Troubleshooting → "I forgot my
  postgres password"** at the bottom.

Throughout this guide, `psql` lives here:

```
C:\Program Files\PostgreSQL\18\bin\psql.exe
```

---

## Step 0 — Open PowerShell in the project

1. Press the **Windows key**, type `PowerShell`, press **Enter**.
2. Go to the server folder (copy-paste this exactly):

   ```powershell
   cd d:\portfolio\AuthKit_Pro\server
   ```

Keep this window open — you'll use it for most steps.

---

## Step 1 — Create the `authkit` database

Run this command. It will **ask for your postgres password** (typing is
invisible — that's normal — just type it and press Enter):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE authkit;"
```

**Expected output:**

```
CREATE DATABASE
```

✅ That means it worked.

- If you see `database "authkit" already exists` — that's fine, it's already
  there. Continue.
- If you see `password authentication failed` — your password was wrong. Try
  again.
- If it hangs or says it can't connect — see **Troubleshooting** below.

> **Prefer a GUI?** Open **pgAdmin 4** (installed with PostgreSQL) → connect →
> right-click **Databases** → **Create → Database…** → name it `authkit` → Save.

---

## Step 2 — Put your password into the config file

The file [`server/.env`](../server/.env) already has all the secrets filled in.
You only need to set your database password.

1. Open the file `d:\portfolio\AuthKit_Pro\server\.env` in your editor (VS Code).
2. Find this line:

   ```
   DATABASE_URL=postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/authkit?schema=public
   ```

3. Replace **`YOUR_PG_PASSWORD`** with your real postgres password.

   Example — if your password is `secret123`:

   ```
   DATABASE_URL=postgresql://postgres:secret123@localhost:5432/authkit?schema=public
   ```

4. **Save the file.**

### ⚠️ If your password has special characters

Characters like `@ : / # ? % & space` must be "URL-encoded" in that line:

| Character | Replace with |
|---|---|
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `?` | `%3F` |
| `%` | `%25` |
| (space) | `%20` |

Example — password `p@ss#1` becomes `p%40ss%231`:

```
DATABASE_URL=postgresql://postgres:p%40ss%231@localhost:5432/authkit?schema=public
```

---

## Step 3 — Create all the tables (run the migration)

Back in your PowerShell window (still in the `server` folder), run:

```powershell
npm run prisma:migrate
```

- It will pause and ask: **"Enter a name for the new migration:"**
- Type:  `init`  and press **Enter**.

**Expected output (last lines):**

```
Applying migration `..._init`
✔ Generated Prisma Client ...
```

✅ This creates every table for Phases 1–5 (users, sessions, roles, organizations,
etc.) and writes a `prisma/migrations/` folder.

- If you see `Environment variable not found: DATABASE_URL` — your `.env` wasn't
  saved, or you're not in the `server` folder. Re-check Step 0 and Step 2.
- If you see `P1000: Authentication failed` — wrong password in `.env` (Step 2).
- If you see `P1001: Can't reach database server` — Postgres isn't running or
  the port is wrong (see Troubleshooting).

---

## Step 4 — Load the starter roles & permissions (seed)

```powershell
npm run prisma:seed
```

**Expected output:**

```
Seeded 8 permissions and 6 roles.
```

✅ This creates the system roles (admin, moderator, manager, editor, customer,
guest) and their permissions.

---

## Step 5 — Start the backend

Still in the `server` folder:

```powershell
npm run dev
```

**Expected output:**

```
Database connection established
🚀 AuthKit Pro API listening on http://localhost:4000
```

✅ Leave this window **running**. (To stop it later: click the window and press
`Ctrl + C`.)

---

## Step 6 — Start the frontend (a second window)

1. Open a **new** PowerShell window (Windows key → PowerShell → Enter).
2. Run:

   ```powershell
   cd d:\portfolio\AuthKit_Pro\client
   npm run dev
   ```

**Expected output:**

```
  ➜  Local:   http://localhost:5173/
```

✅ Leave this running too.

---

## Step 7 — Try it out

1. Open your browser to **http://localhost:5173**.
2. Click **Create one** and register an account.
3. You'll land on the **Dashboard**.

### Where do the emails go?

You haven't configured a mail server, so **verification / password-reset /
invite emails are printed to the server console** (the Step 5 window). Look for a
line like:

```
📧 [console email] (not actually sent)  to: "you@example.com" ...
   ... http://localhost:5173/verify-email?token=XXXXXXXX
```

Copy that link into your browser to verify your email, reset a password, etc.

### Make yourself an admin (optional)

New users get the `customer` role. To see the **Admin** area, give your account
the `admin` role. In a **new** PowerShell window:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d authkit -c "INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email = 'you@example.com' AND r.name = 'admin';"
```

Replace `you@example.com` with the email you registered. Then **refresh the
dashboard** — an **Admin** link appears in the header.

---

## You're done! 🎉

From now on, to run the app you only need **Step 5** (backend) and **Step 6**
(frontend) — the database, migration, and seed are permanent.

---

## Troubleshooting

**`psql: could not connect to server` / `P1001: Can't reach database server`**
- The PostgreSQL service may be stopped. Open **Services** (Windows key → type
  `services.msc`), find **postgresql-x64-18**, right-click → **Start**.
- Confirm it's listening on port 5432 (the default this guide assumes).

**`P1000` / `password authentication failed for user "postgres"`**
- The password in `server/.env` doesn't match. Re-do Step 2. Remember to
  URL-encode special characters.

**`Environment variable not found: DATABASE_URL`**
- You're not in the `server` folder, or `.env` wasn't saved. `cd` into
  `d:\portfolio\AuthKit_Pro\server` and check the file exists.

**`port 5432 ... already in use` when starting Postgres**
- Postgres is already running — that's good, skip starting it.

**`EADDRINUSE: port 4000` when running `npm run dev`**
- Something else is using port 4000. Either stop it, or change `PORT=4000` in
  `server/.env` to e.g. `PORT=4001` (and update the client proxy in
  `client/vite.config.ts` if you do).

**I forgot my postgres password**
- Easiest path: re-run the PostgreSQL installer's **"Reset password"**, or use
  pgAdmin if it still has a saved connection.
- Advanced: temporarily set `trust` auth in `pg_hba.conf`
  (`C:\Program Files\PostgreSQL\18\data\pg_hba.conf`), restart the service, then
  `ALTER USER postgres PASSWORD 'newpass';`, and revert `pg_hba.conf`. Search
  "reset postgres password Windows pg_hba" for a detailed walkthrough.

**Reset everything and start over**
- Drop and recreate the database, then re-run Steps 3–4:
  ```powershell
  & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "DROP DATABASE authkit;"
  & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE authkit;"
  ```
