#!/bin/bash
set -e

echo "Starting application..."

# Try to push schema, but don't fail if it already exists
if npm run db:push 2>&1 | grep -q "already exists"; then
  echo "Database schema already exists, continuing..."
elif [ $? -ne 0 ]; then
  echo "Warning: db:push failed, but continuing anyway..."
fi

# Start the server
echo "Starting server..."
exec node dist/server/server/index.js
