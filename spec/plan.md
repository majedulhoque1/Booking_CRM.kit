# booking-crm-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `booking-crm-kit` public repo — a tool-agnostic build recipe + reference assets that any agent (Claude Code, Codex, Lovable, Antigravity, AI Studio) uses to reproduce a booking + inquiry + admin (analytics/submissions/CRM/calendar) stack on Supabase, themed per client.

**Architecture:** One canonical pack (`spec/RECIPE.md` + `contract/` migrations + `reference/{site,admin}` + thin `adapters/`) in a public GitHub repo. The Supabase backend contract is the single source of truth and is 100% portable; the TanStack + shadcn frontend reference is adapted per tool. See spec: `docs/superpowers/specs/2026-06-29-booking-crm-kit-design.md`.

**Tech Stack:** Supabase (Postgres + RLS + security-definer RPCs + Edge Functions/Deno), TanStack Start + React 19 + Vite, shadcn/ui + Tailwind v4, TypeScript, vitest. Reference code is vendored from `angel-foundation-website` (this repo) and its sibling admin repo.

**Prerequisites (must be in place before Phase 1):**
- A GitHub mechanism to create + push the repo: `gh` CLI authenticated, OR a GitHub PAT with `repo` scope, OR a manually-created empty repo URL. (Resolved with the user separately.)
- Supabase access to the Angel Foundation project to extract the live schema: a Management API **Personal Access Token** (PAT) in env as `SUPABASE_PAT`, plus the project ref. (Supabase MCP is permission-denied for this project — do NOT rely on it.)
- Reference repos checked out locally: this repo, and the sibling admin repo path.

**Conventions:**
- This is an asset/infra build, not a typical app feature. "Tests" are **verification steps**: applying SQL to a scratch DB and asserting objects exist, typechecking vendored code, and re-running migrations to prove idempotency. Where real unit tests already exist (analytics), they are vendored and run.
- Commit after every task. Branch: `main` of the new kit repo.

---

## File Structure (what gets created)

```
booking-crm-kit/
  README.md                         # what the kit is + quickstart per tool
  spec/RECIPE.md                    # tool-agnostic build steps + verify gate
  spec/design.md                    # copy of the approved design spec
  contract/
    migrations/0001_extensions.sql
    migrations/0002_core_tables.sql        # bookings, slots, inquiries, analytics_events, notification_outbox
    migrations/0003_crm.sql                # crm_contacts, crm_notes, submission status
    migrations/0004_roles.sql              # user_roles + has_role()
    migrations/0005_rpcs.sql               # get_available_slots, request_booking, submit_inquiry (+ rate limit)
    migrations/0006_rls.sql                # policies
    migrations/0007_kit_meta.sql           # kit_meta + contract_version stamp
    seed.sql                               # branches, slot generation, config
    edge-functions/send-notifications/index.ts
    README.md                              # data model + RPC API surface + provider matrix
  reference/
    site/...                               # vendored, genericized site code
    admin/...                              # vendored, genericized admin code
  notes/
    env.md                                 # every env var + per-tool naming + provider configs
    theming.md                             # token contract (the ONLY per-client variation)
    verification.md                        # the verify gate, step by step
  adapters/
    claude/SKILL.md
    codex/AGENTS.md
    lovable/KNOWLEDGE.md
    antigravity/rules.md
    aistudio/SYSTEM.md
  scripts/
    verify-contract.sh                     # applies migrations to a scratch DB, asserts, re-applies (idempotency)
  .gitignore
```

---

## Phase 0 — Repo foundation

### Task 0.1: Initialize the kit repo locally

**Files:**
- Create: `booking-crm-kit/.gitignore`
- Create: `booking-crm-kit/README.md`

- [ ] **Step 1: Create the directory and git init**

```bash
mkdir booking-crm-kit && cd booking-crm-kit
git init -b main
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
.env
.env.*
*.log
.DS_Store
.supabase/
scratch/
```

- [ ] **Step 3: Write `README.md`** (skeleton — filled by later tasks)

```markdown
# booking-crm-kit

A tool-agnostic build recipe for a booking + inquiry + admin (analytics / submissions /
CRM / booking-calendar) stack on Supabase. One canonical pack, consumed by many AI agents.

**Start here:** `spec/RECIPE.md`. Per-tool entry points live in `adapters/`.

> Status: scaffolding. See `spec/design.md` for the approved design and
> `docs/plan` history for build progress.
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "chore: scaffold booking-crm-kit repo"
```

### Task 0.2: Vendor the design spec into the repo

**Files:**
- Create: `booking-crm-kit/spec/design.md` (copy of the approved spec)

- [ ] **Step 1: Copy the design spec** from `angel-foundation-website/docs/superpowers/specs/2026-06-29-booking-crm-kit-design.md` into `spec/design.md`.

- [ ] **Step 2: Commit**

```bash
git add spec/design.md && git commit -m "docs: add approved design spec"
```

---

## Phase 1 — Backend contract (the anchor)

> This phase extracts the live Angel Foundation schema and reshapes it into clean,
> idempotent, client-agnostic migrations. The literal SQL is **discovered**, not invented —
> tasks specify how to pull it and what to assert.

### Task 1.1: Extract the live schema via the Management API

**Files:**
- Create (temporary): `booking-crm-kit/scratch/live-dump.sql`

- [ ] **Step 1: Pull the schema** using the Management API query endpoint (replace `<REF>`; `SUPABASE_PAT` in env). This dumps DDL for tables, functions, and policies in the `public` schema.

```bash
# Tables + columns
curl -s "https://api.supabase.com/v1/projects/<REF>/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query":"select table_name, column_name, data_type, is_nullable from information_schema.columns where table_schema='\''public'\'' order by table_name, ordinal_position;"}' \
  > scratch/columns.json

# Function definitions (RPCs)
curl -s "https://api.supabase.com/v1/projects/<REF>/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query":"select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='\''public'\'';"}' \
  > scratch/functions.json

# RLS policies
curl -s "https://api.supabase.com/v1/projects/<REF>/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query":"select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='\''public'\'';"}' \
  > scratch/policies.json
```

- [ ] **Step 2: Verify the dump is non-empty** and contains the expected objects.

Run: inspect `scratch/columns.json` for tables matching bookings/slots/inquiries/analytics/notification, and `scratch/functions.json` for `get_available_slots`, `request_booking`.
Expected: all present. If `request_booking`/`get_available_slots` are missing, STOP — the extraction target or PAT is wrong.

- [ ] **Step 3: Do NOT commit `scratch/`** (gitignored). This is raw working data.

### Task 1.2: Author `0001_extensions.sql` and `0007_kit_meta.sql` (known content)

**Files:**
- Create: `contract/migrations/0001_extensions.sql`
- Create: `contract/migrations/0007_kit_meta.sql`

- [ ] **Step 1: Write `0001_extensions.sql`** (idempotent)

```sql
-- Extensions used by the contract. Safe to re-run.
create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists pg_trgm;       -- search on CRM/inquiries
```

- [ ] **Step 2: Write `0007_kit_meta.sql`** — the version stamp that prevents site/admin drift.

```sql
-- Single-row table stamping the contract version this DB was built against.
create table if not exists public.kit_meta (
  id              boolean primary key default true check (id),  -- enforces single row
  contract_version integer not null,
  updated_at      timestamptz not null default now()
);

-- Upsert the current version. Bump the integer whenever the contract changes.
insert into public.kit_meta (id, contract_version)
values (true, 1)
on conflict (id) do update set contract_version = excluded.contract_version, updated_at = now();

-- Lock down: readable by anon (so an agent can check version), writable by no one via API.
alter table public.kit_meta enable row level security;
drop policy if exists kit_meta_read on public.kit_meta;
create policy kit_meta_read on public.kit_meta for select using (true);
```

- [ ] **Step 3: Commit**

```bash
git add contract/migrations/0001_extensions.sql contract/migrations/0007_kit_meta.sql
git commit -m "feat(contract): extensions + kit_meta version stamp"
```

### Task 1.3: Author `0002_core_tables.sql` from the extracted schema

**Files:**
- Create: `contract/migrations/0002_core_tables.sql`

- [ ] **Step 1: Reshape the extracted DDL** for bookings, slots, inquiries/submissions, analytics_events, notification_outbox into idempotent `create table if not exists` statements. Strip any Angel-specific defaults that should be config (e.g. branch enum values move to `seed.sql`). Keep PII columns; they stay protected by RLS + RPC, not by omission.

- [ ] **Step 2: Verify idempotency locally** (see Task 1.8 harness). Apply twice; second run must be a no-op with no errors.

- [ ] **Step 3: Commit**

```bash
git add contract/migrations/0002_core_tables.sql
git commit -m "feat(contract): core tables (bookings, slots, inquiries, analytics, outbox)"
```

### Task 1.4: Author `0003_crm.sql` (CRM minimal v1)

**Files:**
- Create: `contract/migrations/0003_crm.sql`

- [ ] **Step 1: Write CRM tables** — minimal per spec: contacts, notes, and a status field on submissions.

```sql
create table if not exists public.crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  source      text,                       -- 'booking' | 'inquiry' | 'manual'
  created_at  timestamptz not null default now()
);

create table if not exists public.crm_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  body        text not null,
  author      uuid,                        -- auth.uid() of admin
  created_at  timestamptz not null default now()
);

-- Status on inquiries/submissions for the CRM pipeline.
alter table public.inquiries add column if not exists status text not null default 'new';
-- allowed: 'new' | 'contacted' | 'closed'
```

- [ ] **Step 2: Verify** the `alter table ... add column if not exists` is re-runnable.

- [ ] **Step 3: Commit**

```bash
git add contract/migrations/0003_crm.sql
git commit -m "feat(contract): minimal CRM (contacts, notes, submission status)"
```

### Task 1.5: Author `0004_roles.sql` (admin gate + bootstrap)

**Files:**
- Create: `contract/migrations/0004_roles.sql`

- [ ] **Step 1: Write roles table + `has_role`** (resolves audit gap: admin bootstrap).

```sql
create table if not exists public.user_roles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     text not null,                  -- 'admin'
  primary key (user_id, role)
);

create or replace function public.has_role(p_user uuid, p_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role = p_role);
$$;

alter table public.user_roles enable row level security;
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
  for select using (user_id = auth.uid());
```

- [ ] **Step 2: Document the bootstrap** in `notes/env.md` (created in Phase 3): the first admin is granted by running, once, in the SQL editor / Management API:

```sql
insert into public.user_roles (user_id, role)
values ('<first-admin-auth-uid>', 'admin')
on conflict do nothing;
```

- [ ] **Step 3: Commit**

```bash
git add contract/migrations/0004_roles.sql
git commit -m "feat(contract): user_roles + has_role() admin gate"
```

### Task 1.6: Author `0005_rpcs.sql` (security-definer RPCs + rate limit)

**Files:**
- Create: `contract/migrations/0005_rpcs.sql`

- [ ] **Step 1: Reshape `get_available_slots` and `request_booking`** from the extracted function defs into `create or replace function` form. Preserve the exact param names the reference client calls (`p_from`,`p_to`,`p_name`,`p_phone`,`p_child_age`,`p_branch`,`p_concern`,`p_slot_date`,`p_slot_time`,`p_language`) and the tagged-result JSON shape.

- [ ] **Step 2: Add `submit_inquiry` + a shared rate-limit check** (resolves audit gap: abuse). The rate limiter counts recent rows from the same phone within a window and returns `{"status":"rate_limited"}` before insert. Add the same guard to `request_booking`.

```sql
-- Reusable guard: true if the phone has inserted >= N rows into <tbl> in the last <mins>.
create or replace function public._rate_limited(p_table regclass, p_phone text, p_max int, p_mins int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from %s where phone = $1 and created_at > now() - ($2 || '' minutes'')::interval', p_table)
    into n using p_phone, p_mins;
  return n >= p_max;
end $$;

create or replace function public.submit_inquiry(
  p_name text, p_phone text, p_email text, p_message text, p_language text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_message),'') = '' then
    return jsonb_build_object('status','invalid_input');
  end if;
  if public._rate_limited('public.inquiries', p_phone, 3, 60) then
    return jsonb_build_object('status','rate_limited');
  end if;
  insert into public.inquiries (name, phone, email, message, language)
  values (p_name, p_phone, p_email, p_message, p_language);
  return jsonb_build_object('status','ok');
end $$;
```

- [ ] **Step 3: Verify** all three functions exist after apply and `request_booking` returns `rate_limited` on the 4th rapid call in the test harness.

- [ ] **Step 4: Commit**

```bash
git add contract/migrations/0005_rpcs.sql
git commit -m "feat(contract): RPCs (slots, booking, inquiry) with rate limiting"
```

### Task 1.7: Author `0006_rls.sql` + `seed.sql` + edge function

**Files:**
- Create: `contract/migrations/0006_rls.sql`
- Create: `contract/seed.sql`
- Create: `contract/edge-functions/send-notifications/index.ts`

- [ ] **Step 1: Write RLS policies** — anon gets no direct table SELECT on PII tables (access only via RPC); `analytics_events` anon INSERT-only; admin tables/reads gated by `has_role(auth.uid(),'admin')`. Use `drop policy if exists` then `create policy` for idempotency.

- [ ] **Step 2: Write `seed.sql`** — branches/config + slot generation, all idempotent (`insert ... on conflict do nothing`). Client-specific branch names are placeholders the recipe fills from the brand brief.

- [ ] **Step 3: Vendor the edge function** from `angel-foundation-website/supabase/functions/send-notifications/index.ts`, then genericize the channel: read `NOTIFY_PROVIDER` env and branch to `sms_bd | twilio | whatsapp | webhook` (resolves audit gap: pluggable notifications). Keep the outbox-drain loop identical.

- [ ] **Step 4: Verify** RLS denies anon SELECT on `bookings` and allows anon INSERT on `analytics_events` in the harness.

- [ ] **Step 5: Commit**

```bash
git add contract/migrations/0006_rls.sql contract/seed.sql contract/edge-functions
git commit -m "feat(contract): RLS, seed, pluggable notification edge function"
```

### Task 1.8: Verification harness — `scripts/verify-contract.sh`

**Files:**
- Create: `booking-crm-kit/scripts/verify-contract.sh`
- Create: `booking-crm-kit/notes/verification.md` (stub; expanded in Phase 3)

- [ ] **Step 1: Write the harness** — spin up a scratch Postgres (local `supabase start` or a throwaway Supabase branch), apply all `contract/migrations/*.sql` in order, then **apply them a second time** to prove idempotency, then run assertion queries.

```bash
#!/usr/bin/env bash
set -euo pipefail
DB_URL="${SCRATCH_DB_URL:?set SCRATCH_DB_URL to a throwaway Postgres}"
apply() { for f in contract/migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done; }
echo "== first apply =="; apply
echo "== second apply (idempotency) =="; apply   # must succeed with no errors
echo "== assertions =="
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "select 'has_role' from pg_proc where proname='has_role';"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "select contract_version from public.kit_meta;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "select proname from pg_proc where proname in ('get_available_slots','request_booking','submit_inquiry');"
echo "OK"
```

- [ ] **Step 2: Run it** against a scratch DB.

Run: `SCRATCH_DB_URL=postgres://... bash scripts/verify-contract.sh`
Expected: both applies succeed (idempotency proven), all assertions return rows, prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-contract.sh notes/verification.md
git commit -m "test(contract): idempotency + object-existence verification harness"
```

### Task 1.9: Write `contract/README.md` (the API surface)

**Files:**
- Create: `booking-crm-kit/contract/README.md`

- [ ] **Step 1: Document** the data model (each table + purpose), the RPC API surface (signature + tagged-result values for each), the RLS model, `contract_version`, and the notification provider matrix. This is what frontend reference + adapters read.

- [ ] **Step 2: Commit**

```bash
git add contract/README.md && git commit -m "docs(contract): data model + RPC API surface"
```

---

## Phase 2 — Reference code (site + admin)

> Vendor existing, proven code from the Angel repos and genericize the hardcoded bits.
> Do not rewrite working components.

### Task 2.1: Vendor `reference/site` core

**Files:**
- Create: `reference/site/lib/booking.ts`, `reference/site/lib/analytics.ts`, `reference/site/lib/analytics-collect.ts`
- Create: `reference/site/integrations/supabase/client.ts`
- Create: `reference/site/components/BookingCalendar.tsx`, `ConsultationForm.tsx`
- Create: `reference/site/routes/api.collect.ts`, `book-consultation.tsx`, `contact.tsx`

- [ ] **Step 1: Copy** each file from `angel-foundation-website/src/...` to its `reference/site/...` path. Keep `booking.ts` RPC param names exactly.

- [ ] **Step 2: Genericize hardcoded client values** — replace the hardcoded Supabase URL/anon-key fallbacks in `client.ts` with env-only reads + a clear comment; replace Angel-specific branch lists with a `// FILL: branches from brand brief` marker; keep the stub-client fallback intact.

- [ ] **Step 3: Add `contact.tsx` inquiry wiring** to call the new `submit_inquiry` RPC with a honeypot field (resolves audit gap).

- [ ] **Step 4: Vendor existing tests** `analytics.test.ts`, `analytics-collect.test.ts` to `reference/site/lib/` and run them.

Run: `npx vitest run reference/site/lib/analytics.test.ts reference/site/lib/analytics-collect.test.ts`
Expected: PASS (proves vendored analytics code is intact).

- [ ] **Step 5: Commit**

```bash
git add reference/site && git commit -m "feat(reference): vendor + genericize site code"
```

### Task 2.2: Vendor `reference/admin` core

**Files:**
- Create: `reference/admin/...` (dashboard, submissions table, CRM, booking-calendar management)

- [ ] **Step 1: Copy** the admin components from the sibling admin repo into `reference/admin/...`, genericizing branding and hardcoded config the same way.

- [ ] **Step 2: Confirm** every admin data read goes through a `has_role`-gated RPC/policy (no raw PII table reads). List any that don't and convert them.

- [ ] **Step 3: Commit**

```bash
git add reference/admin && git commit -m "feat(reference): vendor + genericize admin code"
```

---

## Phase 3 — Recipe + adapters + notes

### Task 3.1: Write `notes/theming.md`, `notes/env.md`, expand `notes/verification.md`

**Files:**
- Create/Modify: `notes/theming.md`, `notes/env.md`, `notes/verification.md`

- [ ] **Step 1: `theming.md`** — the token contract (resolves audit gap): the exact CSS variables in `:root` (`--primary/--secondary/--accent/--radius`), the heading/body font pair, the logo path, and the rule "this is the ONLY per-client variation." Include the brand-brief input shape; if absent, the agent must ask.

- [ ] **Step 2: `env.md`** — every env var, its per-tool naming, the admin-bootstrap SQL, and the `NOTIFY_PROVIDER` config matrix (`sms_bd`/`twilio`/`whatsapp`/`webhook` + required secret per provider).

- [ ] **Step 3: `verification.md`** — the full verify gate: contract idempotency, site typecheck+build, booking round-trip, analytics beacon lands, admin first-login read.

- [ ] **Step 4: Commit**

```bash
git add notes && git commit -m "docs(notes): theming contract, env/providers, verify gate"
```

### Task 3.2: Write `spec/RECIPE.md` (the tool-agnostic core)

**Files:**
- Create: `spec/RECIPE.md`

- [ ] **Step 1: Write the recipe** — when to use; inputs (target site/admin, brand brief, branches/slots); the 6-step build flow from the spec; the verify gate; decision points; and the cross-cutting requirements (idempotency, version check, bootstrap, notifications, abuse). Reference `contract/README.md` and `notes/*` rather than duplicating them.

- [ ] **Step 2: Self-check** — a reader with zero context can follow RECIPE.md end-to-end and knows exactly which files to read. No tool-specific instructions here (those live in adapters).

- [ ] **Step 3: Commit**

```bash
git add spec/RECIPE.md && git commit -m "docs(recipe): tool-agnostic build recipe + verify gate"
```

### Task 3.3: Write the five adapters

**Files:**
- Create: `adapters/claude/SKILL.md`, `adapters/codex/AGENTS.md`, `adapters/lovable/KNOWLEDGE.md`, `adapters/antigravity/rules.md`, `adapters/aistudio/SYSTEM.md`

- [ ] **Step 1: `adapters/claude/SKILL.md`** — valid skill frontmatter (`name`, `description`) + body: "read `spec/RECIPE.md`, you can execute migrations via Management API / supabase CLI, write files, run `scripts/verify-contract.sh` and the verify gate; do not report success until the gate passes."

- [ ] **Step 2: `adapters/codex/AGENTS.md`** — same instructions in AGENTS.md form (Codex's native convention), full execution.

- [ ] **Step 3: `adapters/lovable/KNOWLEDGE.md`** — paste-in workspace knowledge: build on Lovable's stack, apply the `contract/` migrations to its Supabase unchanged, adapt the TanStack reference components to Lovable's Vite output, follow the theming token contract.

- [ ] **Step 4: `adapters/antigravity/rules.md`** — project rules/context pointing at the recipe; full execution.

- [ ] **Step 5: `adapters/aistudio/SYSTEM.md`** — system prompt; **generate-only**: emit migrations + code + the bootstrap/verify instructions as copy-out artifacts; state it cannot apply changes itself.

- [ ] **Step 6: Verify** each adapter is ≤ ~30 lines and contains no recipe content duplication (all point back to `spec/RECIPE.md`). Validate `adapters/claude/SKILL.md` frontmatter parses.

- [ ] **Step 7: Commit**

```bash
git add adapters && git commit -m "feat(adapters): claude, codex, lovable, antigravity, aistudio"
```

### Task 3.4: Finalize `README.md` quickstart

**Files:**
- Modify: `booking-crm-kit/README.md`

- [ ] **Step 1: Write the quickstart** — a per-tool "how to use this kit" table (which adapter file to feed each tool) + the capability tiers + a one-paragraph "what you get."

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: finalize README quickstart + per-tool table"
```

---

## Phase 4 — Dogfood (the real test)

### Task 4.1: Run the Claude adapter against a throwaway project

**Files:** none (validation only)

- [ ] **Step 1: Create a throwaway** TanStack Start repo + a throwaway Supabase project (or branch).

- [ ] **Step 2: Follow `adapters/claude/SKILL.md`** to build the `site` target end-to-end: apply contract, seed, scaffold themed components from a sample brand brief, wire env.

- [ ] **Step 3: Run the full verify gate** (`notes/verification.md`).

Run: contract harness + `npm run build` + a manual booking round-trip + confirm an `analytics_events` row lands.
Expected: all green. Record any step where the recipe was ambiguous.

- [ ] **Step 4: Fix recipe/adapters** for every ambiguity found, then re-run. Commit fixes.

```bash
git commit -am "fix(recipe): resolve ambiguities found during dogfood"
```

### Task 4.2: Push to the public GitHub repo

**Files:** none (publish)

- [ ] **Step 1: Create the remote** (mechanism resolved with user):
  - If `gh`: `gh repo create <owner>/booking-crm-kit --public --source=. --remote=origin --push`
  - If PAT: `curl -s -H "Authorization: token $GITHUB_PAT" https://api.github.com/user/repos -d '{"name":"booking-crm-kit","private":false}'` then `git remote add origin <url> && git push -u origin main`
  - If manual: user creates empty repo → `git remote add origin <url> && git push -u origin main`

- [ ] **Step 2: Verify** the repo is public, all phases pushed, README renders.

---

## Self-Review (completed by plan author)

**Spec coverage:** every spec section maps to a task — contract anchor → Phase 1; site/admin targets → Phase 2; RECIPE + 5 adapters → Phase 3; build flow + verify gate → notes/verification + Task 4.1; public-repo source of truth → Task 4.2. All six audit cross-cutting fixes have explicit tasks (theming 3.1, idempotency 1.8, versioning 1.2, bootstrap 1.5, notifications 1.7, abuse 1.6/2.1).

**Placeholder scan:** SQL whose content depends on the live schema (Tasks 1.3, 1.7 step 1–2) is intentionally specified as "reshape extracted DDL with these exact assertions" — not invented SQL — because inventing a client's schema would be worse than discovering it. Every task with knowable content has complete code.

**Type/name consistency:** RPC param names and tagged-result values (`ok|slot_taken|invalid_slot|invalid_input|rate_limited`) are consistent between `0005_rpcs.sql`, `contract/README.md`, and `reference/site/lib/booking.ts`. `has_role`, `user_roles`, `kit_meta.contract_version`, `NOTIFY_PROVIDER` are used identically across tasks.
