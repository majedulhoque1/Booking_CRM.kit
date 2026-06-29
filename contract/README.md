# Backend contract

The **single source of truth** for the booking + inquiry + admin stack. 100% portable:
apply `migrations/*.sql` (in numeric order) to any Supabase project — via the Management
API, the `supabase` CLI, Lovable's migrator, or a hand-paste into the SQL editor — and the
database converges to the same state. Every migration is **idempotent** (re-runnable on a
fresh or partially-built DB). Both build targets (`site`, `admin`) generate their TypeScript
types from this schema, so they cannot drift.

`contract_version` (in `kit_meta`) is currently **1**. Bump it in `0002_config.sql` whenever
the contract changes; the admin build checks it to refuse a stale schema.

## Apply order

```
0001_extensions_and_types.sql   pgcrypto + app_role enum
0002_config.sql                 site_settings (config) + kit_meta (version stamp)
0003_roles_and_profiles.sql     profiles, user_roles, has_role(), handle_new_user()
0004_core_tables.sql            contacts, availability, bookings, inquiries,
                                notification_outbox, analytics_events
0005_booking_rpcs.sql           kit_timezone(), get_available_slots, request_booking,
                                reschedule_booking
0006_analytics_rpcs.sql         analytics_traffic/top_pages/sources/by_country/conversions
0007_notifications.sql          enqueue_booking_notification() trigger on bookings
0008_rls.sql                    Row-Level Security + grants for every table
seed.sql                        default config + bookable windows (client-tunable)
```

## Data model

| Table | Purpose | Key columns |
|---|---|---|
| `site_settings` | Runtime config the RPCs read (never hardcode per client). | `key`, `value`. Keys: `timezone` (IANA, default `UTC`), `notify_staff_phone`. |
| `kit_meta` | Single-row contract version stamp. | `contract_version` |
| `profiles` | Mirror of `auth.users` for admin display. | `id` → `auth.users`, `email`, `display_name` |
| `user_roles` | The admin gate. | `user_id`, `role` (`app_role` enum: `admin`) |
| `contacts` | Deduped lead (by phone). Client-specific intake fields live in `details`. | `name`, `phone`, `email`, `branch`, `details` jsonb, `notes` |
| `availability` | Weekly bookable windows; slots are generated from these. | `weekday` (0=Sun), `start_time`, `end_time`, `slot_minutes`, `active` |
| `bookings` | Calendar bookings. Partial unique index on active rows = race guard. | `contact_id`, `date`, `time`, `status` (`pending`/`confirmed`/`cancelled`), `source` |
| `inquiries` | Unified contact-form + non-slot consultation submissions. | `type` (`contact`/`consultation`), `name`, `phone`, `email`, `message`, `status` (`new`/`contacted`/`closed`) |
| `notification_outbox` | Outbound queue drained by the edge function. | `booking_id`, `event`, `recipient` (`lead`/`staff`), `to_phone`, `payload`, `status` |
| `analytics_events` | First-party pageviews. Server-inserted only. | `occurred_at`, `event_type`, `path`, `referrer_host`, `visitor_hash`, `country`, `device` |

## RPC API surface (the privacy boundary)

The browser calls **only** these. Each is `SECURITY DEFINER` with `search_path = public`.
Booking/inquiry RPCs return a **tagged result**: `{ "status": "..." }`.

### Public (anon + authenticated)

| RPC | Params | Returns |
|---|---|---|
| `get_available_slots` | `p_from date, p_to date` | `setof (slot_date date, slot_time time)` — free slots only, no PII. Empty for a bad/oversized (>60 day) range. |
| `request_booking` | `p_name, p_phone, p_child_age, p_branch, p_concern, p_slot_date, p_slot_time, p_language='en'` | `{status: "ok", booking_id}` \| `slot_taken` \| `invalid_slot` \| `invalid_input`. `p_child_age`/`p_concern` are the reference site's intake fields, stored in `contacts.details`. |

> The contact form writes inquiries via a **direct anon INSERT** into `public.inquiries`
> (RLS allows insert-only), not an RPC.

### Admin (authenticated, self-gated by `has_role`)

| RPC | Params | Returns |
|---|---|---|
| `reschedule_booking` | `p_booking_id uuid, p_slot_date date, p_slot_time time` | `ok` \| `forbidden` \| `not_found` \| `invalid_slot` \| `slot_taken`. Keeps status, notifies lead + staff directly. |
| `analytics_traffic` | `p_from, p_to` | `(day, pageviews, unique_visitors)` |
| `analytics_top_pages` | `p_from, p_to, p_limit=20` | `(path, pageviews, unique_visitors)` |
| `analytics_sources` | `p_from, p_to` | `(source, referrer_host, pageviews)` — channel = direct/search/social/referral |
| `analytics_by_country` | `p_from, p_to` | `(country, pageviews, unique_visitors)` |
| `analytics_conversions` | `p_from, p_to` | jsonb: `bookings_by_status`, `consultation_submissions`, `contact_submissions`, `book_consultation_views`, `contact_views` |

`has_role(_user_id uuid, _role app_role) -> boolean` backs every admin gate.
`kit_timezone() -> text` resolves `site_settings.timezone` (→ `UTC` fallback) and is used by
all date math, so a client changes its timezone in one row with no SQL edit.

## RLS model (`0008`)

- **anon** — no direct table reads anywhere. Can `INSERT` into `inquiries`; everything else
  goes through the `SECURITY DEFINER` RPCs. `bookings`/`contacts`/`notification_outbox` are
  revoked from anon outright.
- **authenticated admin** (`has_role(auth.uid(),'admin')`) — full read/write on the
  operational tables; reads analytics only through the RPCs.
- **`analytics_events`** — RLS on with **no policy = deny-all**. The collector inserts with
  the `service_role` key (bypasses RLS); admins read via the `analytics_*` RPCs.
- **`kit_meta`** — world-readable (so an agent can check `contract_version`).

## Admin bootstrap

A fresh project has no admin (chicken-and-egg). After migrations, grant the first admin once:

```sql
insert into public.user_roles (user_id, role)
values ('<first-admin-auth-uid>', 'admin') on conflict do nothing;
```

## Notifications (`send-notifications` edge function)

The trigger (`0007`) enqueues `notification_outbox` rows: **staff** alerted on a new request +
confirmation; **lead** messaged on confirmation + cancellation; both on reschedule. The edge
function drains the queue through a **pluggable provider** selected by the `NOTIFY_PROVIDER`
env var:

| `NOTIFY_PROVIDER` | Secret(s) | Notes |
|---|---|---|
| `sms_bd` | `SMS_API_KEY`, `SMS_SENDER_ID` | Bangladesh SMS gateway (Angel default) |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | |
| `whatsapp` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | |
| `webhook` | `NOTIFY_WEBHOOK_URL` | POSTs the payload; you wire delivery |

The schema is channel-agnostic; switching providers never touches it.

## Verify

`scripts/verify-contract.sh` applies all migrations **twice** (proving idempotency) against a
throwaway DB, then asserts objects exist and a booking round-trips. See `notes/verification.md`.
