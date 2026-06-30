---
name: booking-crm-kit
description: Use when building or re-theming a booking + inquiry + admin (analytics/CRM/booking-calendar) stack on Supabase for a client. Applies the portable backend contract and scaffolds themed TanStack + shadcn reference code by following the kit's RECIPE.
---

# booking-crm-kit (Claude Code adapter — Tier 1, full execution)

You can execute the whole build. Clone/open this kit, then:

1. **Read `spec/RECIPE.md`** — it is the build flow, inputs, decision points, and gate. Also read
   `contract/README.md` and `notes/{theming,env,verification}.md` as referenced.
2. **Gather inputs** from the user: target (`site`/`admin`/both), Supabase project, brand brief,
   business config (branches, hours, timezone, notify phone, provider).
3. **Apply the backend**: run `contract/migrations/0001`→`0008` in order + `contract/seed.sql` via
   the Supabase Management API or `supabase` CLI (they're idempotent). Deploy
   `contract/edge-functions/send-notifications`; set `NOTIFY_PROVIDER` + secret.
4. **Scaffold** `reference/site` and/or `reference/admin` into the target repo, theme via
   `notes/theming.md`, resolve every `FILL:` marker, wire env (`notes/env.md`), bootstrap the
   first admin.
5. **Run the verify gate** (`notes/verification.md`) — incl. `scripts/verify-contract.sh` against a
   THROWAWAY DB (never the client's prod). Bare Postgres? add `APPLY_TEST_SHIMS=1`.

**Do not report success until the gate passes.** Match `contract/README.md` names exactly; don't
rewrite working reference logic — only theme + fill.
