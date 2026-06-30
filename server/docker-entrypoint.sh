#!/bin/sh
set -e

# Apply any pending database migrations before the app accepts traffic.
# Safe to run on every boot — `migrate deploy` only applies new migrations.
echo "Running database migrations…"
npx prisma migrate deploy

echo "Starting AuthKit Pro server…"
exec "$@"
