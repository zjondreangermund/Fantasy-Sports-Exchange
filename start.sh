#!/bin/bash
set -e

echo "Starting application..."

# DATABASE_URL is mandatory for this app (sessions + core data).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Provision PostgreSQL in Railway and attach it to this service, or set DATABASE_URL manually."
  exit 1
fi

# Build-time repair scripts are intentionally idempotent. Re-apply the Admin
# Read-only maintenance bypass before startup verification so a clean runtime
# checkout is validated against the same rule used to compile the server.
echo "Preparing Admin Read-only maintenance bypass..."
node scripts/apply-admin-readonly-bypass.mjs
node scripts/verify-admin-readonly-startup.mjs

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

# Production can contain an older competition_status enum even when the current
# Drizzle schema declares the newer lifecycle values. Repair it outside any
# transaction so newly-added enum values are immediately usable by the sync.
echo "Preparing competition status lifecycle enum..."
node scripts/ensure-competition-status-enum.mjs

# Rebuild all 190 official paid 2026/27 Prize Ladder tournament slots from live
# FPL fixtures (38 gameweeks × 5 rarities). The sync preserves every existing
# entry row and never deletes player teams.
echo "Syncing and verifying all 38 paid official gameweeks..."
if ! node scripts/sync-official-tournaments.mjs; then
  echo "ERROR: official tournament sync did not produce complete 38-gameweek coverage."
  echo "Refusing to start this deployment with a partial tournament calendar."
  exit 1
fi

# Create/refresh one FREE Card Cup for every rarity in every gameweek, using the
# exact same fixture windows as the paid official tournaments. Winners progress
# Common→Rare, Rare→Unique, Unique→Epic, Epic→Legendary and Legendary→Legendary.
# Existing FREE Cup entries are preserved; no entry rows are deleted or moved.
echo "Syncing and verifying all FREE Card Cups..."
if ! node scripts/sync-free-card-tournaments.mjs; then
  echo "ERROR: FREE Card Cup sync did not produce complete 38-gameweek coverage."
  echo "Refusing to start this deployment with incomplete FREE tournament coverage."
  exit 1
fi

# Start only after all 380 official season slots are present: 190 paid + 190 free.
echo "Starting server..."
exec node dist/server/server/index.js
