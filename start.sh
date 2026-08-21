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

# Refresh the current API-Football Premier League squad directory before card
# reconciliation. The helper forces league ID 39 and uses the existing Pro
# quota/backoff/cache service. Failure is non-destructive: FPL identity/images
# remain available and the normal scheduler retries after the server starts.
echo "Refreshing current Premier League API-Football player directory..."
node scripts/refresh-epl-api-football-directory-startup.mjs

# Patch the reconciliation with a safe overflow recovery before it touches the
# database. Old bulk/test and duplicate-player data can contain more cards than
# the current rarity supply permits (for example two Legendary copies where the
# current cap is one). The recovery keeps legitimate signup/prize/reward/trade
# ownership first, removes weak legacy full-set ownership, and archives any
# history-referenced excess card instead of deleting history or aborting deploy.
echo "Preparing legacy card supply overflow recovery..."
node scripts/apply-reconcile-supply-overflow-fix.mjs

# Reconcile legacy card ownership against the official current Premier League
# FPL roster BEFORE serial canonicalization. This merges duplicate legacy player
# identities into the canonical current EPL player row, repairs affected serials
# and uses API-Football portraits when an exact current-squad identity is
# available. If FPL itself is temporarily unavailable the script safely makes no
# destructive changes and startup continues.
echo "Reconciling Premier League player identities and legacy card inventory..."
node scripts/reconcile-production-card-inventory-v2.mjs

# The final test-card cleanup must respect active competition locks. Expired,
# cancelled and completed competition locks are released; cards still referenced
# by a live/closed tournament are deferred until that tournament settles/cancels
# so no submitted lineup or tournament history is altered and startup never dies
# on the database's prevent_locked_card_transfer guard.
echo "Preparing locked-card safety for final test-card cleanup..."
node scripts/apply-finalize-locked-card-safety.mjs

# The old full-set test grant left many cards attached to the four accounts even
# after generic history/FK protection prevented deletion. Finalize those accounts
# by keeping signup cards, tournament-winning cards and other explicit earned or
# purchased provenance only. Unlocked leftovers are unowned and moved to an
# isolated legacy archive identity; actively competition-locked leftovers are
# reported as deferred and will be removed automatically on a later startup.
echo "Finalizing old full-set test-card ownership..."
node scripts/finalize-full-set-test-card-cleanup.mjs

# Repair legacy enum namespaces and canonicalize any remaining old card serials
# for every user after the inventory cleanup. This gives surviving legitimate old
# cards the current serial system while enforcing the true rarity supply caps.
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
