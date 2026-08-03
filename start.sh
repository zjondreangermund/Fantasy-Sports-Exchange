#!/bin/bash
set -e

echo "Starting application..."

# DATABASE_URL is mandatory for this app (sessions + core data).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Provision PostgreSQL in Railway and attach it to this service, or set DATABASE_URL manually."
  exit 1
fi

# Fail the deployment if the read-only guard, admin security links, tournament
# settlement route or marketplace/auction routes drift out of alignment.
echo "Verifying read-only and route contracts..."
node scripts/verify-read-only-route-integrity.mjs

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
# Entry availability is scheduled before the first Premier League kickoff, while
# each competition's end_date is the following Tuesday 23:59 CAT score-freeze
# and settlement cutoff. Existing entries and user-created tournaments remain.
echo "Syncing official rarity tournaments..."
node scripts/sync-official-tournaments.mjs || echo "Warning: official tournament sync failed; starting with existing tournaments."

# Start the server
echo "Starting server..."
exec node dist/server/server/index.js
