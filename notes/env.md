# Environment & secrets

No secrets live in this repo. The anon key is publishable (RLS enforces access); the service
role key and notification secrets live only in the deploy environment. Set these per build target.

## Site (public app)

| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client (build-time) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client (build-time) | publishable anon key |
| `SUPABASE_URL` | server (`/api/collect`) | analytics insert target |
| `SUPABASE_SERVICE_ROLE_KEY` | server (`/api/collect`) | service role — bypasses RLS to write `analytics_events` |
| `ANALYTICS_SALT` | server (`/api/collect`) | salt for the daily visitor hash |
| `ANALYTICS_TZ` | server (`/api/collect`) | IANA tz for the day boundary; **set equal to `site_settings.timezone`** (default `UTC`) |

## Admin app

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | same project; admin auth + RPC calls |

## Edge function `send-notifications`

| Var | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | drain `notification_outbox` |
| `NOTIFY_PROVIDER` | which channel to send through (see matrix) |
| provider secret(s) | per the matrix below |

### `NOTIFY_PROVIDER` matrix

| `NOTIFY_PROVIDER` | Required secret(s) | Notes |
|---|---|---|
| `sms_bd` | `SMS_API_KEY`, `SMS_SENDER_ID` | Bangladesh SMS gateway (the Angel default) |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS/voice |
| `whatsapp` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | WhatsApp Cloud API |
| `webhook` | `NOTIFY_WEBHOOK_URL` | POSTs the payload; you wire delivery |

Switching providers never touches the schema — the outbox is channel-agnostic.

## Per-tool naming

- **TanStack Start / Vite (Claude, Codex, Antigravity):** client vars need the `VITE_` prefix
  (exposed to the browser); server/edge vars do not.
- **Lovable:** set Supabase vars via its Supabase integration; add the rest as project secrets.
  Client vars still need the `VITE_` prefix in its Vite output.
- **AI Studio (generate-only):** it cannot hold secrets — emit a `.env.example` listing these
  for the user to fill in their own deploy.

## Admin bootstrap (run once, after migrations)

A fresh project has no admin. Grant the first one via the SQL editor / Management API:

```sql
insert into public.user_roles (user_id, role)
values ('<first-admin-auth-uid>', 'admin') on conflict do nothing;
```

Get the uid from the Supabase Auth users list after that person signs up. The `admin` verify
gate (see `notes/verification.md`) is "this user signs in and the dashboard returns data."
