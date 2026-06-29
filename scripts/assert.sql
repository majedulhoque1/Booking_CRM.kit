-- Contract assertions. Run after migrations + seed are applied. Any failure raises
-- and (with psql -v ON_ERROR_STOP=1) aborts the verify run with a non-zero exit.

-- 1. object existence -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'has_role')     then raise exception 'missing has_role()'; end if;
  if not exists (select 1 from pg_proc where proname = 'kit_timezone') then raise exception 'missing kit_timezone()'; end if;
  if (select count(distinct proname) from pg_proc
      where proname in ('get_available_slots','request_booking','reschedule_booking')) <> 3
    then raise exception 'missing a booking RPC'; end if;
  if (select count(distinct proname) from pg_proc
      where proname in ('analytics_traffic','analytics_top_pages','analytics_sources',
                        'analytics_by_country','analytics_conversions')) <> 5
    then raise exception 'missing an analytics RPC'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_booking_notification')
    then raise exception 'missing booking notification trigger'; end if;
end $$;

-- 2. contract version -------------------------------------------------------------
do $$
begin
  if (select contract_version from public.kit_meta) <> 1
    then raise exception 'unexpected contract_version'; end if;
end $$;

-- 3. RLS posture ------------------------------------------------------------------
do $$
declare n int;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass)
    then raise exception 'analytics_events RLS not enabled'; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename='analytics_events';
  if n <> 0 then raise exception 'analytics_events must have no policy (deny-all), found %', n; end if;
  if not exists (select 1 from pg_policies
      where schemaname='public' and tablename='inquiries' and cmd='INSERT')
    then raise exception 'inquiries missing anon INSERT policy'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.bookings'::regclass)
    then raise exception 'bookings RLS not enabled'; end if;
end $$;

-- 4. functional booking round-trip ------------------------------------------------
do $$
declare
  v_slot  record;
  v_res   jsonb;
  v_count int;
begin
  select slot_date, slot_time into v_slot
  from public.get_available_slots(current_date, current_date + 14) limit 1;
  if not found then raise exception 'seed produced no available slots'; end if;

  v_res := public.request_booking('Test Parent','01700000000', 7, 'Main', 'general',
                                  v_slot.slot_date, v_slot.slot_time, 'en');
  if v_res->>'status' <> 'ok' then raise exception 'request_booking expected ok, got %', v_res; end if;

  select count(*) into v_count from public.bookings where status='pending';
  if v_count < 1 then raise exception 'booking row not created'; end if;

  v_res := public.request_booking('Other','01700000001', 8, 'Main', 'general',
                                  v_slot.slot_date, v_slot.slot_time, 'en');
  if v_res->>'status' <> 'slot_taken' then raise exception 'expected slot_taken, got %', v_res; end if;

  v_res := public.request_booking('', '12', 7, 'Main', 'x',
                                  v_slot.slot_date, v_slot.slot_time, 'en');
  if v_res->>'status' <> 'invalid_input' then raise exception 'expected invalid_input, got %', v_res; end if;
end $$;

-- 5. reschedule is admin-gated (no admin context → forbidden) ----------------------
do $$
declare v_res jsonb;
begin
  perform set_config('app.current_uid', '', true);
  v_res := public.reschedule_booking(gen_random_uuid(), current_date + 1, time '10:00');
  if v_res->>'status' <> 'forbidden' then raise exception 'expected forbidden, got %', v_res; end if;
end $$;

-- 6. admin path: confirm enqueues outbox; analytics gate opens ---------------------
do $$
declare
  v_uid     uuid := gen_random_uuid();
  v_booking uuid;
  v_res     jsonb;
  v_out     int;
begin
  update public.site_settings set value='01999999999' where key='notify_staff_phone';
  insert into auth.users (id, email) values (v_uid, 'admin@test.local') on conflict do nothing;
  insert into public.user_roles (user_id, role) values (v_uid, 'admin') on conflict do nothing;
  perform set_config('app.current_uid', v_uid::text, true);

  select id into v_booking from public.bookings where status='pending' order by created_at limit 1;
  if v_booking is null then raise exception 'no pending booking to confirm'; end if;

  update public.bookings set status='confirmed' where id = v_booking;
  select count(*) into v_out from public.notification_outbox where booking_id = v_booking;
  if v_out < 1 then raise exception 'confirm did not enqueue outbox rows (got %)', v_out; end if;

  v_res := public.analytics_conversions(current_date - 7, current_date + 1);
  if v_res = '{}'::jsonb then raise exception 'analytics_conversions denied an admin'; end if;
end $$;
