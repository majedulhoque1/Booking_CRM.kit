# reference/site

Proven public-site code, genericized. Vendor these into the target repo's `src/`, theme via
the token contract (`notes/theming.md`), and replace the `FILL:` markers from the brand brief.
**Don't rewrite the booking/analytics logic** — only theme + fill.

```
lib/booking.ts              get_available_slots / request_booking client (exact RPC params)
lib/analytics.ts            client beacon → /api/collect (+ test)
lib/analytics-collect.ts    server collector; service-role insert; ANALYTICS_TZ-aware (+ test)
integrations/supabase/client.ts   env-only client + stub fallback (keeps build green pre-env)
routes/api.collect.ts       POST endpoint for the beacon
components/BookingCalendar.tsx     two-step booking (calendar → details)
components/ConsultationForm.tsx    inquiry form → public.inquiries (anon INSERT) + honeypot
components/BookConsultationButton.tsx
routes/book-consultation.tsx · routes/contact.tsx
```

## External deps the consuming app provides
- `@/lib/language` — `useLanguage()` returning `{ lang: "en" | "bn" }`. Single-language sites
  can stub it to `{ lang: "en" }`.
- `@/components/ui/calendar` — shadcn Calendar.
- `@/components/site/Layout`, `@/components/site/FadeIn` — page chrome / animation wrapper.
- Theme classes/tokens: `card-soft`, `btn-accent`, `--color-supporting`, `secondary` etc.
  (defined by `notes/theming.md`).

## Env
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client); `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANALYTICS_SALT`, `ANALYTICS_TZ` (server `/api/collect`).
See `notes/env.md`.

## FILL markers
`BRANCHES` (BookingCalendar), `{SITE_NAME}` + `branches` + phone/WhatsApp + hours (routes),
intake fields (child_age/concern are the reference example → `contacts.details`).
