#!/bin/bash
set -e

echo "Starting application..."

# DATABASE_URL is mandatory for this app (sessions + core data).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Provision PostgreSQL in Railway and attach it to this service, or set DATABASE_URL manually."
  exit 1
fi

# Attempt the declarative schema push and always preserve its diagnostics. Older
# production databases may report conflicts for objects that already exist, so
# the runtime preflight below remains the authoritative compatibility repair.
set +e
DB_PUSH_OUTPUT=$(npm run db:push 2>&1)
DB_PUSH_STATUS=$?
set -e
printf '%s\n' "$DB_PUSH_OUTPUT"
if [ "$DB_PUSH_STATUS" -eq 0 ]; then
  echo "Database schema push completed."
else
  echo "Warning: db:push failed with exit code $DB_PUSH_STATUS; running compatibility preflight."
fi

# Repair legacy enum namespaces and canonicalize card serials before the server
# seed path can touch those records. This step is idempotent and fails closed.
echo "Preparing runtime database compatibility..."
node scripts/prepare-runtime-startup.mjs

# Rebuild the official 2026/27 tournament calendar from live FPL fixtures.
# This removes only old official ladder tournaments, preserves user-created cups,
# creates one tournament per rarity per gameweek, and adjusts Tuesday windows
# when a Premier League midweek round would overlap.
echo "Syncing official rarity tournaments..."
node scripts/sync-official-tournaments.mjs || echo "Warning: official tournament sync failed; starting with existing tournaments."

# Start the server
echo "Starting server..."
exec node dist/server/server/index.js
