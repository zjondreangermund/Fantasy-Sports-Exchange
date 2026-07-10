#!/bin/bash
set -e

echo "Starting application..."

# DATABASE_URL is mandatory for this app (sessions + core data).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Provision PostgreSQL in Railway and attach it to this service, or set DATABASE_URL manually."
  exit 1
fi

# Try to push schema, but don't fail if it already exists
if npm run db:push 2>&1 | grep -q "already exists"; then
  echo "Database schema already exists, continuing..."
elif [ $? -ne 0 ]; then
  echo "Warning: db:push failed, but continuing anyway..."
fi

# Rebuild the official 2026/27 tournament calendar from live FPL fixtures.
# This removes only old official ladder tournaments, preserves user-created cups,
# creates one tournament per rarity per gameweek, and adjusts Tuesday windows
# when a Premier League midweek round would overlap.
echo "Syncing official rarity tournaments..."
node scripts/sync-official-tournaments.mjs || echo "Warning: official tournament sync failed; starting with existing tournaments."

# Start the server
echo "Starting server..."
exec node dist/server/server/index.js
