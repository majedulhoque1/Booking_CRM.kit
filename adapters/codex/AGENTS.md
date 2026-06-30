# booking-crm-kit (Codex / generic-agent adapter — Tier 1, full execution)

Drop this file at the target repo root (or point your agent at this kit). AGENTS.md is the
native convention Codex and most coding agents read on startup.

You can execute the whole build. **Start by reading `spec/RECIPE.md`** in this kit — it is the
authoritative build flow (inputs → apply backend → gen types → scaffold + theme → wire env →
bootstrap admin → verify gate). It points you to `contract/README.md` and `notes/*` for details;
don't duplicate them here.

Execution checklist:
- Apply `contract/migrations/0001`→`0008` (in order) + `contract/seed.sql` to the client's
  Supabase (`supabase db push` or the Management API). Idempotent — safe to re-run.
- Deploy `contract/edge-functions/send-notifications`; set `NOTIFY_PROVIDER` + its secret.
- Vendor `reference/site` / `reference/admin`, theme via `notes/theming.md`, resolve all `FILL:`
  markers, wire env (`notes/env.md`), bootstrap the first admin.
- Run the verify gate (`notes/verification.md`); `scripts/verify-contract.sh` needs a THROWAWAY DB
  (never client prod). Bare Postgres → `APPLY_TEST_SHIMS=1`.

Rules: match `contract/README.md` names exactly; theme + fill, don't rewrite reference logic;
do not claim success before the gate passes.
