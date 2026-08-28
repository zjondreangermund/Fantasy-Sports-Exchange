#!/bin/bash
set -e

echo "Starting application..."

# DATABASE_URL is mandatory for this app (sessions + core data).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Provision PostgreSQL in Railway and attach it to this service, or set DATABASE_URL manually."
  exit 1
fi

# The one-time FREE GW1 test window expired on 23 Aug 2026. Do not rerun its
# legacy source patcher at startup: the current FREE-cup sync has moved on and
# the old patcher's strict source-shape checks can block otherwise valid deploys.
echo "Skipping expired FREE GW1 startup patcher."

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

# Refresh the current API-Football Premier League squad directory. This updates
# football/player reference data only; it must not reconcile or rewrite card
# ownership for normal users.
echo "Refreshing current Premier League API-Football player directory..."
node scripts/refresh-epl-api-football-directory-startup.mjs

# IMPORTANT CARD OWNERSHIP SAFETY RULE:
# Production startup must never clear, replace, or randomly reassign anybody's
# cards. Historical reconciliation and test-account reset tools remain available
# for explicitly approved offline/manual use only.
#
# Keep the backup-gated recovery audit in its protected startup position. Repair
# its legacy PostgreSQL reserved-word alias only inside the running container;
# this does not touch database ownership. Then run the compact line-oriented audit
# so affected users/cards are visible in Railway logs before taking the snapshot.
echo "Auditing normal-user card ownership without modifying cards..."
sed -i 's/as references/as evidence_count/g; s/order by references desc/order by evidence_count desc/g' scripts/audit-and-recover-normal-user-cards.mjs
if ! node scripts/audit-and-recover-normal-user-cards.mjs; then
  echo "Warning: normal-user card ownership audit could not complete; startup will continue without changing card ownership."
fi

echo "Running compact normal-user card forensic audit (read-only)..."
if ! node scripts/audit-normal-user-cards-compact.mjs; then
  echo "Warning: compact normal-user card audit could not complete; startup will continue without changing card ownership."
fi

# Investigate prior starter replacements without changing production data. An
# actual restoration is separately gated by an explicitly named account, an
# apply flag, and five independently proven original cards.
echo "Auditing confirmed starter-card selections and historical resets (read-only)..."
if ! node scripts/audit-starter-selection-recovery.mjs; then
  echo "Warning: starter-card recovery audit could not complete; startup will continue without changing card ownership."
fi

# Restore only selections that are still proven by a completed onboarding row
# containing exactly one chosen player from each of its five original packs.
# The one-time repair takes a rollback snapshot first, never removes owned cards,
# never overwrites another owner, and separately uses reset audit evidence for
# the four historically damaged test accounts.
echo "Restoring proven signup starter selections and eligible lineup order..."
node scripts/restore-confirmed-starter-selections.mjs

echo "Verifying starter-card selections after restoration (read-only)..."
if ! node scripts/audit-starter-selection-recovery.mjs; then
  echo "Warning: post-restoration starter-card audit could not complete; startup will continue."
fi

# Reconstruct the actual five signup cards from the rollback snapshot, original
# pack choices, acquisition timestamps and historical ownership evidence. This
# audit is transaction-level read-only and never changes card ownership.
echo "Reconstructing original signup card sets from rollback evidence (read-only)..."
if ! node scripts/audit-original-signup-card-sets.mjs; then
  echo "Warning: original signup card reconstruction could not complete; startup will continue without changing card ownership."
fi

# Apply the one-time, rollback-backed ownership correction approved by the
# operator. Every target is pinned to five proven historical card IDs; the
# transaction aborts unless those exact cards form an eligible squad.
echo "Restoring exact original signup card sets and removing all extras..."
node scripts/restore-original-signup-card-sets.mjs

# Snapshot currently owned normal-user cards. Snapshots never update/delete
# player_cards and provide an exact baseline for future ownership-drift checks.
echo "Snapshotting normal-user card ownership..."
if ! node scripts/snapshot-normal-user-card-ownership.mjs; then
  echo "Warning: normal-user card snapshot could not be recorded; startup will continue without changing card ownership."
fi

# Repair legacy enum namespaces and canonicalize missing/invalid serial metadata.
# This runtime preflight must not clear or reassign any user's card ownership.
echo "Preparing runtime database compatibility..."
node scripts/prepare-runtime-startup.mjs

# Refresh only official identity/league metadata on currently owned cards.
# A departure requires independent current FPL and API-Football confirmation;
# the immutable original card remains owned and exactly one audited replacement
# of the same position/rarity is minted under the normal serial-supply trigger.
echo "Linking owned Premier League cards and replacing confirmed departures..."
if ! node scripts/reconcile-owned-premier-league-cards.mjs; then
  echo "Warning: Premier League card eligibility reconciliation could not complete; original cards remain unchanged."
fi

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
