# RECIPE — build a booking + inquiry + admin stack from this kit

**This is the entry point for an agent USING the kit** (not building it — that history is in
`spec/plan.md`). Read this top to bottom, then your per-tool adapter in `adapters/`.

## What you're building

A Supabase-backed stack, themed per client:
- **site** — public booking calendar + consultation/contact inquiry form + first-party analytics.
- **admin** — analytics dashboard, submissions table, minimal CRM, booking-calendar management.

The **backend contract** (`contract/`) is the anchor and is 100% portable — apply it unchanged
to any Supabase project. The **frontend** is TanStack Start + shadcn reference code you vendor
and theme; non-TanStack tools (e.g. Lovable's Vite default) adapt it, keeping the contract intact.

## When to use

A client needs online appointment booking + an inquiry form + a private admin panel, and you
want the proven pattern rather than rebuilding it. Not for: payments, non-Supabase auth, or
multi-tenant single-DB (each client = its own Supabase project).

## Inputs (gather first)

1. **Target(s):** `site`, `admin`, or both.
2. **Supabase project:** URL + keys (or create one). Management-API access or SQL-editor access
   to apply migrations.
3. **Brand brief:** palette, fonts, logo, tone — see `notes/theming.md`. No brief → ask.
4. **Business config:** locations/branches, business hours / slot length, timezone, staff
   notify phone, notification provider (`notes/env.md`).

## Build flow

1. **Ask** for the inputs above (target, brand brief, business config).
2. **Backend first.** Apply `contract/migrations/0001`→`0008` **in order**, then `contract/seed.sql`,
   to the project's Supabase (Management API, `supabase db push`, Lovable's migrator, or paste
   into the SQL editor). They're idempotent — safe if some objects already exist. Deploy
   `contract/edge-functions/send-notifications` and set `NOTIFY_PROVIDER` + its secret.
   Override seeded config for the client: `update public.site_settings set value=… where key in
   ('timezone','notify_staff_phone');` and replace the default `availability` rows with the
   client's hours.
3. **Generate types** from the live schema (`supabase gen types typescript`) so site + admin
   share one source of truth and cannot drift.
4. **Scaffold the target(s).** Vendor `reference/site/` and/or `reference/admin/` into the app's
   `src/`. Theme via the token block (`notes/theming.md`). Resolve every `FILL:` marker from the
   brand brief / business config (branches, site name, phone/WhatsApp, hours, intake fields).
   Wire the external deps each reference README lists (language, Layout/FadeIn, shadcn Calendar).
5. **Wire env** (`notes/env.md`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the server
   `SUPABASE_SERVICE_ROLE_KEY` / `ANALYTICS_SALT` / `ANALYTICS_TZ` for `/api/collect`.
6. **Bootstrap admin** (if building `admin`): after the client signs up, run the
   `insert into user_roles … 'admin'` from `notes/env.md`.
7. **Verify (the gate).** Run `notes/verification.md`. Do **not** report success until it passes.

On generate-only tools (AI Studio), steps 2 / 5 / 6 are emitted as copy-out SQL + instructions
rather than executed.

## Decision points

- **Intake fields differ from the reference?** `request_booking` carries `p_child_age` / `p_concern`
  as examples, stored in `contacts.details` (jsonb). Swap them for the client's fields in the
  RPC signature + the form + `details` payload — the table schema does not change.
- **Single language?** Stub `useLanguage()` to `{ lang: "en" }`; drop the second-language strings.
- **No physical locations?** Remove the `branches` block in the contact route and the branch
  `<select>` in the booking form.
- **Behind on schema?** If `kit_meta.contract_version` is lower than what the admin reference
  expects, re-apply the newer migrations before scaffolding `admin` — this is the drift guard.

## Cross-cutting requirements (don't skip)

- **Idempotent migrations** — always re-runnable; never hand-edit a client DB outside migrations.
- **contract_version check** before building `admin` (above).
- **Admin bootstrap** is required or no one can log in (`notes/env.md`).
- **Pluggable notifications** — pick `NOTIFY_PROVIDER`; never hardcode a channel in SQL.
- **Abuse protection** — `request_booking` rate-limits server-side; the inquiry form is a direct
  anon INSERT guarded by a **honeypot** (already in `reference/site/components/ConsultationForm.tsx`).
  Keep both.

## Reference, don't duplicate

- Data model + every RPC signature/result → `contract/README.md`
- Tokens + brand brief shape → `notes/theming.md`
- Env vars + provider matrix + bootstrap → `notes/env.md`
- The verify gate → `notes/verification.md`
- Your tool's execution specifics → `adapters/<tool>/…`
