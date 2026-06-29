# booking-crm-kit

A **tool-agnostic build recipe** for a booking + inquiry + admin (analytics / submissions /
CRM / booking-calendar) stack on **Supabase**. One canonical pack, consumed by many AI agents
(Claude Code, Codex, Lovable, Antigravity, Google AI Studio) so each new client site reproduces
the same proven pattern, themed per client — without rebuilding it by hand every time.

> **Status: v0 (seed).** This repo currently holds the approved **design** (`spec/design.md`)
> and the **implementation plan** (`spec/plan.md`). The buildable contents — `contract/`
> migrations, `reference/` code, `spec/RECIPE.md`, and `adapters/` — are produced by executing
> the plan. The first build task extracts the live Supabase schema into versioned migrations.

## What it will contain

| Path | Purpose |
|------|---------|
| `spec/RECIPE.md` | The tool-agnostic build steps + verify gate (source of truth) |
| `contract/` | Supabase migrations, seed, edge function — the backend anchor (100% portable) |
| `reference/site` · `reference/admin` | Vendored TanStack + shadcn reference code, themed per client |
| `notes/` | Theming token contract, env + notification providers, the verify gate |
| `adapters/` | Thin per-tool entry points (Claude, Codex, Lovable, Antigravity, AI Studio) |

## Capability tiers (honest)

| Tool | Executes migrations / writes files / verifies? | Tier |
|------|------|------|
| Claude Code | Yes — full | 1 |
| Codex | Yes — full | 1 |
| Lovable | Yes, in its own sandbox & default Vite stack | 1 (stack caveat) |
| Antigravity | Yes — agentic IDE | 1 |
| Google AI Studio | No — generates code/SQL you copy out | 2 |

The **Supabase backend contract is universal**; the **TanStack frontend reference is adapted
per tool** rather than ported to every framework.

## License

TBD by owner.
