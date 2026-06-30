# booking-crm-kit (Lovable adapter — Tier 1, stack caveat)

Paste this into your Lovable **workspace knowledge** (or attach the kit's raw files to the
`create_project` message). Lovable builds in its own sandbox on its **default Vite stack (not
TanStack)** — the backend contract applies unchanged; the frontend reference is adapted.

Follow `spec/RECIPE.md` as the build plan. Key Lovable specifics:

- **Backend:** apply `contract/migrations/0001`→`0008` (in order) + `contract/seed.sql` to the
  project's Supabase via Lovable's Supabase integration / migrator — **unchanged**. They're
  idempotent. Deploy `contract/edge-functions/send-notifications` as a Supabase Edge Function;
  set `NOTIFY_PROVIDER` + secret.
- **Frontend:** treat `reference/site` / `reference/admin` as the behavior spec. Re-implement the
  components in Lovable's Vite + shadcn output — same RPC calls, same `inquiries` anon-INSERT +
  honeypot, same analytics `/api/collect` flow. Keep `contract/README.md` names exact.
- **Theme:** apply the token block from `notes/theming.md` (the only per-client variation).
- **Env:** `notes/env.md` (client vars keep the `VITE_` prefix).
- **Verify:** booking round-trips, an `analytics_events` row lands, admin first-login reads.

Don't change the schema to fit the UI — adapt the UI to the contract.
