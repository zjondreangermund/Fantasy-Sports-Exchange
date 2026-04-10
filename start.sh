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

# Start the server
echo "Starting server..."
exec node dist/server/server/index.js
