# booking-crm-kit (Antigravity adapter — Tier 1, full execution)

Add this as a project rules / context file. Antigravity is an agentic IDE — it can execute the
whole build.

**Authoritative plan: `spec/RECIPE.md`** in this kit. Read it first; it covers inputs, the apply
flow, decision points, and the verify gate, and references `contract/README.md` + `notes/*` for
detail (don't duplicate them).

Do:
- Apply `contract/migrations/0001`→`0008` (in order) + `contract/seed.sql` to the client's Supabase
  (Management API or `supabase` CLI) — idempotent. Deploy `contract/edge-functions/send-notifications`;
  set `NOTIFY_PROVIDER` + secret.
- Vendor `reference/site` / `reference/admin`, theme via `notes/theming.md`, resolve all `FILL:`
  markers, wire env (`notes/env.md`), bootstrap the first admin.
- Run the verify gate (`notes/verification.md`); `scripts/verify-contract.sh` against a THROWAWAY
  DB only (bare Postgres → `APPLY_TEST_SHIMS=1`).

Rules: match `contract/README.md` names exactly; theme + fill, don't rewrite reference logic; no
success claim before the gate passes.
