-- booking-crm-kit · seed · client-tunable defaults
-- Idempotent: every insert is guarded, so seeding a fresh OR already-seeded DB
-- converges to the same state. The recipe OVERRIDES these from the brand brief
-- (business hours, timezone, staff phone) — they are sane defaults, not fixed values.

-- ----- runtime config (0002 already inserts these; keep here as the documented knobs) -----
-- timezone: IANA tz for "future slot" math + analytics day-bucketing.
-- notify_staff_phone: where staff booking alerts go ('' disables staff alerts).
insert into public.site_settings (key, value) values
  ('timezone', 'UTC'),
  ('notify_staff_phone', '')
on conflict (key) do nothing;

-- ----- default bookable windows -----
-- Mon–Fri, two 60-minute windows (09:00–12:00, 14:00–17:00). weekday: 0=Sun .. 6=Sat.
-- Inserted only when the table is empty, so re-running never duplicates and a client
-- that has set its own hours is left untouched.
insert into public.availability (weekday, start_time, end_time, slot_minutes, active)
select w, t.start_time, t.end_time, 60, true
from (values (1),(2),(3),(4),(5)) as d(w)                       -- Mon..Fri
cross join (values (time '09:00', time '12:00'),
                   (time '14:00', time '17:00')) as t(start_time, end_time)
where not exists (select 1 from public.availability);
