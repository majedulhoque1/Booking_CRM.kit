# booking-crm-kit

A **tool-agnostic build recipe** for a booking + inquiry + admin (analytics / submissions /
CRM / booking-calendar) stack on **Supabase**. One canonical pack, consumed by many AI agents
(Claude Code, Codex, Lovable, Antigravity, Google AI Studio) so each new client reproduces the
same proven pattern, themed per client — without rebuilding it by hand every time.

## What you get

A portable **backend contract** (versioned, idempotent Supabase migrations + RLS + security-definer
RPCs + a pluggable notification edge function) that applies unchanged to any project, plus
**reference frontend code** (TanStack Start + shadcn) for the public **site** and the **admin**
panel that you vendor and theme. Schema is the single source of truth, so site and admin can't drift.

## Start here

➡️ **Using the kit to build a client stack? Read [`spec/RECIPE.md`](spec/RECIPE.md)**, then your
tool's adapter below. RECIPE is the build flow; the adapter is the per-tool execution wrapper.

(Building/extending the kit itself? That history lives in [`spec/plan.md`](spec/plan.md) and
[`spec/design.md`](spec/design.md) — not the entry point for *using* it.)

## Per-tool quickstart

| Tool | Feed it | Tier |
|------|---------|------|
| **Claude Code** | install [`adapters/claude/SKILL.md`](adapters/claude/SKILL.md) as a skill (or open the repo and point at it) | 1 — full execution |
| **Codex / generic agents** | drop [`adapters/codex/AGENTS.md`](adapters/codex/AGENTS.md) at the target repo root | 1 — full execution |
| **Lovable** | paste [`adapters/lovable/KNOWLEDGE.md`](adapters/lovable/KNOWLEDGE.md) into workspace knowledge | 1 — own sandbox, Vite stack |
| **Antigravity** | add [`adapters/antigravity/rules.md`](adapters/antigravity/rules.md) as a project rules file | 1 — agentic IDE |
| **Google AI Studio** | paste [`adapters/aistudio/SYSTEM.md`](adapters/aistudio/SYSTEM.md) as the system prompt | 2 — generate-only (copy artifacts out) |

Tier 1 tools apply migrations, write files, and run the verify gate themselves. Tier 2 (AI Studio)
generates the SQL/code/instructions for you to apply.

## Layout

| Path | Purpose |
|------|---------|
| [`spec/RECIPE.md`](spec/RECIPE.md) | **The build recipe** — inputs, flow, decisions, verify gate |
| [`contract/`](contract/) | Migrations `0001–0008`, `seed.sql`, edge function — the portable backend anchor ([`contract/README.md`](contract/README.md) = data model + RPC API) |
| [`reference/site`](reference/site) · `reference/admin` | TanStack + shadcn reference code, themed + filled per client |
| [`notes/`](notes/) | [`theming.md`](notes/theming.md) (token contract) · [`env.md`](notes/env.md) (env + providers) · [`verification.md`](notes/verification.md) (the gate) |
| [`adapters/`](adapters/) | Thin per-tool entry points (all point back to `spec/RECIPE.md`) |
| [`scripts/`](scripts/) | `verify-contract.sh` + assertions (idempotency + object/RLS checks) |

## Scope

Anchored on **TanStack Start + Supabase + shadcn/ui**. The Supabase contract is universal; the
TanStack frontend reference is adapted per tool (not ported to every framework). Non-goals:
payments, non-Supabase auth, multi-tenant single-DB (each client = its own Supabase project).

## License

TBD by owner.
