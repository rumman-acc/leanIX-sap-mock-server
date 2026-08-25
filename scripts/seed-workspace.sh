#!/usr/bin/env bash
# Re-seeds the development workspace (idempotent — packages/prisma/seed.ts uses upserts with
# deterministic ids, so running this again just refreshes the same records).
set -euo pipefail

cd "$(dirname "$0")/.."
npm run prisma:seed
