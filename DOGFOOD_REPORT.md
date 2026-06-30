# Dogfood report

**Date:** 2026-06-30 · **Method:** a cloud Claude Code routine (Opus 4.8) ran the Claude adapter
against this kit as a consuming agent, then a local session reproduced + landed the fixes.

> Why two sessions: the cloud routine completed the audit and fixes and verified the contract
> against a throwaway Postgres, but its git token was **read-only** (HTTP 403 on push to every
> branch — confirmed not branch-protection). Its commits were stranded in the ephemeral container,
> so the fixes below were reproduced and pushed from a local checkout. (Action item for future
> push-capable routines: grant the session write access.)

## Verdict

The kit is internally consistent and the backend contract verifies end-to-end. **One real bug and
two doc gaps found and fixed.** No schema or RPC contract changes.

## Part A — static consistency audit (all checks ran)

| Check | Result |
|---|---|
| A.1 RPC names / params / tagged-results identical across migrations 0005-0006, `contract/README.md`, `reference/site/lib/booking.ts`, `reference/admin/hooks/*` | **PASS** |
| A.2 Every table/column used by `reference/site` + `reference/admin/hooks` exists in migrations 0002-0008 | **PASS** — no dangling references |
| A.3 Env var names consistent across `notes/env.md`, site/admin clients, `analytics-collect.ts`, edge function | **PASS after fix** (two undocumented vars + one alias) |
| A.4 All 5 adapters point to `spec/RECIPE.md`, ≤~30 lines; `adapters/claude/SKILL.md` frontmatter valid | **PASS** (20-24 lines each) |
| A.5 Every `FILL:` marker explained in `notes/theming.md` / a reference README | **PASS** |

## Part B — contract verification (throwaway DB only, never prod)

The cloud run had `psql` + Docker and verified against a throwaway Postgres 16:

- `scripts/verify-contract.sh` → `OK — contract verified` (both applies idempotent + all assertions).
- Role-scoped probes as the real `anon` role: booking round-trip `ok → slot_taken → invalid_input`;
  anon `INSERT` into `inquiries` **allowed**; anon `SELECT` on `bookings` / `analytics_events` /
  `contacts` **denied**.

Local re-validation of the fix: the corrected `analytics_sources` classification was checked
against a 20-host truth table (Postgres `~*` semantics) — all pass, including the former
false-positives. (Local `verify-contract.sh` re-run was skipped — Docker daemon was down at the
time — but the change is a `create or replace` body edit that does not affect idempotency, already
proven green in the cloud run.)

## Fixes landed

1. **`fix(contract)` — `analytics_sources` mis-classification (real bug).**
   The unanchored regexes matched brand tokens as substrings: `netflix.com` / `box.com` →
   `social` (via `x.com`), `att.com` → `social` (via `t.co`), `combing.com` → `search` (via
   `bing`). Anchored every token to a domain-label boundary (`(^|\.)brand\.`, and `(^|\.)(t\.co|x\.com)(\.|$)`
   for the two short hosts). Validated with a 20-host truth table.
2. **`docs(env)` — gaps in `notes/env.md`.** Documented `NOTIFY_BRAND` and the optional
   `SMS_API_URL` (both read by the edge function but previously absent) and the admin client's
   `VITE_SUPABASE_PUBLISHABLE_KEY` alias for the anon key.

## Not run / out of scope

- Full app build/typecheck — the kit has no node/npm setup by design; not expected.
