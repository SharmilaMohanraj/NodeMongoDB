#!/usr/bin/env bash
# Deployment script: installs production dependencies and starts the API in the foreground.
# Required env (or a .env file next to this script): MONGODB_URI, JWT_SECRET. Optional: PORT (8000), MONGODB_DB, LOG_LEVEL.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${MONGODB_URI:?MONGODB_URI is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
export PORT="${PORT:-8000}"
npm install --omit=dev --no-audit --no-fund
exec node src/server.js
