# reference/admin

Reference for the **admin** build target (a separate app, same Supabase). What's here is the
**presentational foundation** (already genericized — clean of any client specifics) plus this
build spec mapping each admin screen to the contract. Compose the screens from these building
blocks + the RPCs in `contract/README.md`, themed via `notes/theming.md`. Same rule as
`reference/site`: theme + fill, don't fork the contract.

> Status: foundation + **contract-bound data layer** (auth + admin gate + `hooks/`) + a complete
> reference screen (`pages/Availability.tsx`) are shipped. The remaining page UIs
> (Submissions/CRM/Bookings/Settings/Analytics) are built by composing the matching hook + the
> `_kit` primitives, following the Availability screen as the exact pattern. They are NOT copied
> verbatim from the source admin because that app's pages reference excluded CMS tables
> (`programs`) and a different schema (`child_age` columns, `consultation_submissions`, status
> `new|reviewed|converted`) — the hooks below are already corrected to the contract.

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

## Auth + data layer (contract-bound, shipped)

```
context/AuthContext.tsx       Supabase Auth provider + useAuth() (null-safe when env unset)
components/ProtectedRoute.tsx gates routes on session AND admin role
hooks/useIsAdmin.ts           admin check via the user_roles self-read RLS policy
hooks/useAvailability.ts      CRUD on `availability`
hooks/useSubmissions.ts       `inquiries` (status new|contacted|closed) + convert-to-contact
hooks/useBookings.ts          `bookings` confirm/cancel (fires notify trigger) + reschedule_booking RPC
hooks/useContacts.ts          `contacts` CRM list + notes
hooks/useAnalytics.ts         the 5 analytics_* RPCs for a date range
hooks/useSettings.ts          `site_settings` (timezone, notify_staff_phone)
lib/slots.ts                  generateDaySlots — mirrors get_available_slots
pages/Availability.tsx        complete reference screen (the pattern to follow)
```

Every hook is null-safe (`supabase` may be null pre-env) and uses **only** contract tables/RPCs.

External deps the consuming app supplies: a router (`react-router-dom` in the reference),
`@tanstack/react-query`, shadcn-style `ui/` (Button, Modal, DataTable, FormField), recharts,
lucide-react, and the theme tokens (`notes/theming.md`).

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
