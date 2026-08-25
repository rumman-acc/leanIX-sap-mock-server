#!/usr/bin/env bash
# One-shot local setup: installs deps, builds shared package, generates Prisma client,
# runs migrations, and seeds the database. Assumes DATABASE_URL/REDIS_URL are already
# reachable (either via `docker compose up -d postgres redis`, or native/managed services —
# see docs/BUILD_STATUS.md for how this repo's own dev environment was set up).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.mock .env
  echo "Created .env from .env.mock — edit REDIS_URL/DATABASE_URL if needed."
fi

echo "Installing dependencies..."
npm install

echo "Building shared package..."
npm run build --workspace=packages/shared

echo "Generating Prisma client..."
npm run prisma:generate

echo "Running migrations..."
npm run prisma:migrate

echo "Seeding database..."
npm run prisma:seed

echo "Setup complete. Start the API with: npm run dev"
