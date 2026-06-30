# reference/admin

Reference for the **admin** build target (a separate app, same Supabase). What's here is the
**presentational foundation** (already genericized — clean of any client specifics) plus this
build spec mapping each admin screen to the contract. Compose the screens from these building
blocks + the RPCs in `contract/README.md`, themed via `notes/theming.md`. Same rule as
`reference/site`: theme + fill, don't fork the contract.

> Status: foundation + spec vendored. The data screens below are specified here (RPCs, gating,
> building blocks) rather than shipped verbatim, because the source admin app entangles them with
> client-specific CMS pages the kit deliberately excludes. Build each screen on the foundation.

## Foundation (vendored, generic)

```
lib/supabase.ts          env-only client (VITE_SUPABASE_URL / _ANON_KEY) + isSupabaseConfigured guard
lib/types.ts             Database type stub — replace with `supabase gen types` output
lib/utils.ts             cn() + shared helpers
components/AppShell.tsx           authenticated layout shell
components/PageHeader.tsx · EmptyState.tsx · StatCard.tsx · StatusBadge.tsx   UI primitives
components/PageErrorBoundary.tsx  per-page error boundary
components/ToastProvider.tsx · toast-context.ts · hooks/useToast.ts   toasts
components/bookings/TimeGridCalendar.tsx   props-driven week/day time-grid (the booking calendar UI)
```

External deps the consuming app supplies: a router, Supabase Auth context + a `ProtectedRoute`
that checks session **and** `has_role(auth.uid(),'admin')`, shadcn/ui, recharts, lucide-react,
and the theme tokens (`notes/theming.md`).

## Screen → contract mapping (build spec)

Every read is admin-gated: analytics through the SECURITY-DEFINER `analytics_*` RPCs (self-gated
by `has_role`), all tables through the RLS admin policies (`contract/migrations/0008`). **No screen
reads a PII table without the admin gate.**

| Screen | Reads / calls | Notes |
|---|---|---|
| **Dashboard** | `analytics_conversions`, counts on `bookings` | `StatCard` summary tiles |
| **Analytics** | `analytics_traffic`, `analytics_top_pages`, `analytics_sources`, `analytics_by_country`, `analytics_conversions` | recharts; date-range picker → `p_from`/`p_to` |
| **Submissions** | `inquiries` (select; update `status` new→contacted→closed) | `StatusBadge`; admin RLS |
| **CRM** | `contacts` (+ `contacts.notes` for the CRM note; `details` jsonb for intake) | minimal CRM v1 |
| **Bookings** | `bookings` (update `status` confirm/cancel → fires the notify trigger); `reschedule_booking(p_booking_id,p_slot_date,p_slot_time)` | `TimeGridCalendar` for the calendar view |
| **Availability** | `availability` CRUD (admin RLS write) | drives `get_available_slots` on the site |
| **Settings** | `site_settings` (`timezone`, `notify_staff_phone`) | admin-only RLS |
| **Login** | Supabase Auth (`signInWithPassword`) | then `ProtectedRoute` enforces `has_role` |

## Auth + bootstrap

`ProtectedRoute` must allow only users where `has_role(auth.uid(),'admin')` is true. The first
admin is granted once via the bootstrap insert in `notes/env.md` — until then the dashboard is
correctly empty (the gate denies everything), which is the expected pre-bootstrap state.

## Verify (admin target)

Per `notes/verification.md`: the bootstrapped admin signs in and each screen's RPC/table returns
data; a non-admin session sees nothing (gate holds); confirming a booking enqueues a
`notification_outbox` row.
