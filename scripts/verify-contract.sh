#!/usr/bin/env bash
# Verify the backend contract against a THROWAWAY database (never prod):
#   1. apply all contract migrations + seed,
#   2. apply them a SECOND time to prove idempotency,
#   3. run scripts/assert.sql (object existence, RLS posture, booking round-trip).
#
# Usage:
#   SCRATCH_DB_URL=postgres://user:pass@host:5432/db bash scripts/verify-contract.sh
#
# Against a bare Postgres (no Supabase auth/roles), also pass APPLY_TEST_SHIMS=1 to
# install scripts/test-shims.sql first. NEVER set that flag against a real Supabase DB
# (it would overwrite auth.uid()).
set -euo pipefail

DB_URL="${SCRATCH_DB_URL:?set SCRATCH_DB_URL to a throwaway Postgres connection string}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
run() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

if [ "${APPLY_TEST_SHIMS:-0}" = "1" ]; then
  echo "== test shims (bare-Postgres only) =="
  run "$ROOT/scripts/test-shims.sql"
fi

apply() {
  for f in "$ROOT"/contract/migrations/*.sql; do
    echo "   $(basename "$f")"
    run "$f"
  done
  echo "   seed.sql"
  run "$ROOT/contract/seed.sql"
}

echo "== first apply =="
apply
echo "== second apply (idempotency) =="
apply
echo "== assertions =="
run "$ROOT/scripts/assert.sql"
echo "OK — contract verified (idempotent + assertions passed)"
