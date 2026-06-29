# Verification gate

The agent does **not** report success until this passes.

## 1. Contract (always)

Apply every migration twice (idempotency) + run assertions against a **throwaway** DB:

```bash
# Real throwaway Supabase (branch or scratch project) — has auth + roles already:
SCRATCH_DB_URL='postgres://...:5432/postgres' bash scripts/verify-contract.sh

# Bare Postgres (e.g. an ephemeral docker container) — install test shims too:
APPLY_TEST_SHIMS=1 SCRATCH_DB_URL='postgres://postgres:postgres@localhost:5432/postgres' \
  bash scripts/verify-contract.sh
```

Expect: both applies succeed, assertions print `OK — contract verified`. `assert.sql` checks
object existence, `contract_version`, RLS posture (`analytics_events` deny-all, `inquiries`
anon-INSERT), a booking round-trip (`ok` → `slot_taken` → `invalid_input`), the admin-gated
`reschedule_booking` (`forbidden` without an admin), and confirm-enqueues-outbox.

Quick local run with Docker (no host psql needed):

```bash
docker run -d --name bcrmkit-verify -e POSTGRES_PASSWORD=postgres postgres:16
docker cp . bcrmkit-verify:/work
docker exec -e APPLY_TEST_SHIMS=1 \
  -e SCRATCH_DB_URL='postgres://postgres:postgres@localhost:5432/postgres' \
  bcrmkit-verify bash /work/scripts/verify-contract.sh
docker rm -f bcrmkit-verify
```

## 2. Site target (when scaffolding `site`)

- `npm run build` / typecheck green.
- A booking round-trips through the UI (slot list → request → confirmation).
- An `analytics_events` row lands after a pageview (server `/api/collect` → service role).

## 3. Admin target (when scaffolding `admin`)

- `contract_version` matches what the admin reference expects (else refuse/warn).
- The bootstrapped first admin signs in and reads the dashboard (RPCs return data).
