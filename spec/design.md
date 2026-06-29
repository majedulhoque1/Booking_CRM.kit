# booking-crm-kit — design spec

**Date:** 2026-06-29
**Status:** Approved design, pending implementation plan
**Author:** Majedul (with Claude Code)
**Reference implementation:** `angel-foundation-website` (this repo) + its sibling admin repo

## Problem

Across client projects (Angel Foundation, and future "intelligent websites") the same
slab of work is rebuilt every time: a booking system, an inquiry/contact form, and an
admin panel containing analytics, submissions, a CRM, and a booking calendar. Rebuilding
this by hand each project is slow and drifts in quality. We want to codify the proven
pattern once so an AI builder reproduces it reliably, themed per client.

## Decisions (locked)

1. **Reuse model:** AI rebuilds from a spec (a build recipe), not a forked template repo
   and not a shared npm package. Tradeoff accepted: one bugfix = update the recipe and
   re-run per site; sites do not share a live dependency.
2. **Multi-tool, not Claude-only.** The kit must be usable by Claude Code, Codex,
   Lovable, Antigravity, Google AI Studio, and other agents. Achieved via **one
   canonical tool-agnostic pack + thin per-tool adapters** (each adapter ~20 lines that
   point back to the one recipe). Claude Code & Codex are the full-execution authoring
   targets.
3. **Source of truth:** a single **public GitHub repo** (`booking-crm-kit`) holds the
   recipe, migrations, reference code, and adapters. Local agents clone it; cloud tools
   (Lovable, AI Studio) get its raw URL / content pasted in. Public is safe — migrations
   are schema/RLS/RPCs only, no secrets; the anon key is already publishable; service and
   notification secrets live in env, never in the repo.
4. **Scope:** One unified kit, anchored on the proven stack: **TanStack Start + Supabase +
   shadcn/ui**. Covers backend + public site + admin as build targets. Schema is the
   single source of truth so site and admin cannot drift.
5. **Admin:** same kit, separate build target (built into its own repo, same Supabase).
6. **CRM depth:** minimal v1 — contacts + notes + a status field on each submission.

## Non-goals (YAGNI for v1)

- No payments, no auth provider beyond Supabase Auth.
- No multi-tenant single-DB design — each client gets its own Supabase project.
- The backend contract is universal; the **frontend reference is TanStack-specific**. The
  kit does NOT try to be a polished component library for every framework — non-TanStack
  tools (e.g. Lovable's default Vite stack) adapt the reference code, guided by per-tool
  notes. We accept some adaptation rather than maintain N framework ports.
- The kit does not *host* code as an importable package; it regenerates per repo.

## Architecture

One **canonical pack** in a public GitHub repo, consumed by many tools through thin
adapters. The pack is a **build recipe + reference assets**, not a library — an agent
reads it and scaffolds themed code into whatever repo it's invoked in.

```
github.com/<you>/booking-crm-kit   (public repo — single source of truth)
  spec/RECIPE.md            # THE recipe: when to use, build steps, decision points, verify gate
  contract/                 # THE ANCHOR — backend single source of truth (100% portable)
    migrations/*.sql        # tables, RLS, RPCs, indexes (captured from live Supabase)
    edge-functions/send-notifications/index.ts
    seed.sql                # slots / branches / config seed
    README.md               # data model + RPC API surface
  reference/
    site/                   # reference code (TanStack + shadcn), themed per client
    admin/                  # reference code (TanStack + shadcn), themed per client
  notes/
    env.md
    theming.md
    verification.md
  adapters/                 # thin (~20 lines each); all point back to spec/RECIPE.md
    claude/SKILL.md         # Claude Code skill wrapper (full execution)
    codex/AGENTS.md         # Codex / generic agents — AGENTS.md is their native convention
    lovable/KNOWLEDGE.md    # paste into Lovable workspace knowledge / create_project message
    antigravity/rules.md    # Antigravity context/rules file
    aistudio/SYSTEM.md      # paste-in system prompt for AI Studio (generate-only)
```

**How each tool consumes it:**

- **Claude Code** — install `adapters/claude/SKILL.md` as a skill (or clone the repo and
  point at it); it executes migrations, writes files, runs the verify gate.
- **Codex** — drop `adapters/codex/AGENTS.md` at the target repo root; Codex reads it
  natively and executes.
- **Lovable** — paste `adapters/lovable/KNOWLEDGE.md` into workspace knowledge (or attach
  to the `create_project` initial message). Builds in Lovable's sandbox; frontend adapts
  to its stack, backend contract applies unchanged to its Supabase.
- **Antigravity** — add `adapters/antigravity/rules.md` as a project rules/context file.
- **Google AI Studio** — paste `adapters/aistudio/SYSTEM.md` as the system prompt. **Tier
  2: generate-only** — it produces code/SQL you copy out; it cannot apply migrations or
  write your repo itself.

### Capability tiers (honest)

| Tool | Executes (migrations / files / verify)? | Tier |
|------|------|------|
| Claude Code | Yes — full | 1 |
| Codex | Yes — full | 1 |
| Lovable | Yes, in its own sandbox & default stack (Vite, not TanStack) | 1 (stack caveat) |
| Antigravity | Yes — agentic IDE | 1 |
| Google AI Studio | No — generates code to copy | 2 |

### The backend contract (the heart)

Everything else consumes this. It captures what currently lives only inside Supabase with
no migrations (the fragile, non-reproducible part):

- **Tables:** bookings, slots, inquiries/submissions, analytics events, notification
  outbox, CRM contacts + notes, **`user_roles`** (the admin gate), **`kit_meta`** (holds
  `contract_version`).
- **RPCs (security-definer — the privacy boundary):** the browser calls only these, never
  raw tables. Proven examples from the reference repo:
  - `get_available_slots(p_from, p_to) -> { slot_date, slot_time }[]`
  - `request_booking(p_name, p_phone, p_child_age, p_branch, p_concern, p_slot_date,
    p_slot_time, p_language) -> tagged result`
  - `submit_inquiry(p_name, p_phone, p_email, p_message, p_language) -> tagged result`
  - `has_role(p_user, p_role) -> bool` (used by admin RLS).
- **Tagged-result convention:** `{ status: "ok" | "slot_taken" | "invalid_slot" |
  "invalid_input" | "rate_limited" }` so the UI handles every case explicitly.
- **RLS:** anon = INSERT-only / RPC-only; admin reads gated by `has_role`.
- **Edge function:** `send-notifications` drains the notification outbox via a **pluggable
  channel provider** (see Cross-cutting #5).

The recipe versions this contract. Both targets generate their TypeScript types *from* it,
so site and admin cannot fall out of sync.

## Cross-cutting requirements (resolved in audit, 2026-06-29)

1. **Theming contract.** "Themed per client" = the agent fills one tokens file
   `notes/theming.md` defines: shadcn/Tailwind CSS variables in `:root` (brand
   `--primary`/`--secondary`/`--accent`, `--radius`), a font pair (heading/body), and a
   logo asset path. Build input = a **brand brief** (palette, fonts, logo, tone) supplied
   by the user or extracted from an existing site. No brief → agent asks before scaffolding.
   This is the ONLY place per-client variation is allowed; everything else is identical.
2. **Idempotent migrations (hard requirement).** All `contract/migrations/*.sql` use
   `create table if not exists`, `create or replace function`, `drop policy if exists` +
   recreate, etc. — re-runnable on a fresh OR partially-built DB. This is what lets the
   same SQL apply via Management API (Claude), Lovable's migrator, or a hand paste into the
   SQL editor (AI Studio) and converge to the same state.
3. **Contract versioning.** `kit_meta.contract_version` (a single-row table) stamps the
   schema version. Migrations bump it. Before scaffolding `admin`, the agent reads this and
   refuses (warns) if the target's version is behind what the admin reference expects —
   killing the drift the whole kit exists to prevent.
4. **Admin role bootstrap.** Fresh project has no admin → chicken-and-egg. The recipe ships
   a documented bootstrap: after migrations, run a one-line `insert into user_roles` for the
   first admin's `auth.uid()` (via SQL editor / Management API), captured in
   `notes/env.md`. The verify gate for `admin` includes "first admin can sign in and read".
5. **Pluggable notifications.** The outbox is channel-agnostic; `send-notifications` reads a
   `NOTIFY_PROVIDER` env (`sms_bd` | `twilio` | `whatsapp` | `webhook`) and a matching
   secret. Default for Angel-style clients = the existing SMS path; new clients pick a
   provider without touching the schema. Provider configs documented in `notes/env.md`.
6. **Abuse protection on anon endpoints.** `request_booking` / `submit_inquiry` are
   anon-callable, so each enforces a lightweight server-side rate limit (per phone/IP window
   in the RPC) returning `status: "rate_limited"`, plus a honeypot field on the forms. No
   external captcha in v1.

### Build target: `site`

Public-facing, TanStack Start + shadcn. Generates:

- Booking calendar (`BookingCalendar`), consultation form (`ConsultationForm`),
  `book-consultation` route, booking client (`lib/booking.ts` calling the RPCs).
- Inquiry / contact form.
- First-party analytics: `lib/analytics.ts` (sendBeacon → `/api/collect`),
  `analytics-collect` handler, `api.collect` route.
- The **stub Supabase client** fallback (keeps SSR/admin from crashing when env is missing).

### Build target: `admin`

Built into the separate admin repo, pointed at the same Supabase. Generates:

- Analytics dashboard (recharts).
- Submissions table.
- CRM (minimal: contacts + notes + status per submission).
- Booking-calendar management.
- `has_role`-gated access.

## Build flow (when an agent runs the recipe)

1. Ask: target (`site` / `admin`), client name, branding tokens, branches / slot config.
2. **Backend first:** apply `contract/migrations` to the project's Supabase (or detect
   they already exist), deploy the edge function, seed config.
3. Generate TypeScript types from the live schema.
4. Scaffold the chosen target's components, themed to the client.
5. Wire env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, notification secrets.
6. **Verify (gate):** typecheck + build green; a booking round-trips; analytics beacon
   lands. The agent does not report success without this.

On Tier-2 tools (AI Studio) steps 2, 5, and 6 are produced as copy-out artifacts and
instructions rather than executed directly.

## Key dependency / first real task

The kit is only as good as the contract, and the schema currently lives **only inside
Supabase** (this repo has the `send-notifications` edge function but no migrations).
Therefore step one of *building the kit* is extracting the live schema into SQL
migrations. Supabase MCP has been permission-denied for this project before, so capture
likely goes via the Management API + PAT (the path used in related projects) or a manual
SQL export. Everything else (reference code, adapters) consumes this contract.

## Build order (high level, for the plan)

1. Extract live Supabase schema → `contract/migrations/*.sql` + `contract/README.md`.
2. Vendor reference code (`reference/site`, `reference/admin`) from this repo + admin repo.
3. Write `spec/RECIPE.md` (build steps + verify gate) — the tool-agnostic core.
4. Write the five thin adapters pointing at the recipe.
5. Dogfood: run the Claude adapter against a throwaway repo and confirm the verify gate.

## Open questions

None blocking. CRM depth and non-goals confirmed minimal for v1.
