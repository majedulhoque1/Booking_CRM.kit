-- booking-crm-kit · 0005 · booking RPCs (security definer — the privacy boundary)
-- The public site calls ONLY get_available_slots + request_booking; the browser
-- never touches the bookings/contacts tables directly. reschedule_booking is
-- admin-only. All "now" math is timezone-aware, reading site_settings.timezone
-- (0002) so the same SQL serves any client without edits. Idempotent.

-- ----- kit_timezone(): the single source of "what day is it for this client" -----
-- Read by every booking + analytics function. Falls back to UTC if unset.
create or replace function public.kit_timezone()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = 'timezone'), 'UTC');
$$;

-- ----- get_available_slots: returns ONLY free {date,time} (no PII) -----
create or replace function public.get_available_slots(p_from date, p_to date)
returns table(slot_date date, slot_time time)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp := (now() at time zone public.kit_timezone());
begin
  -- guardrails: bad or oversized range returns nothing (fail safe)
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 60 then
    return;
  end if;

  return query
  with dates as (
    select g::date as the_date
    from generate_series(p_from, p_to, interval '1 day') as g
  ),
  candidate as (
    select
      dt.the_date,
      (a.start_time + (n.i * make_interval(mins => a.slot_minutes)))::time as the_time
    from dates dt
    join public.availability a
      on a.active
     and a.weekday = extract(dow from dt.the_date)::int
    join lateral generate_series(
      0,
      greatest(0, (floor(extract(epoch from (a.end_time - a.start_time))
                         / (a.slot_minutes * 60)) - 1)::int)
    ) as n(i) on true
  )
  select c.the_date, c.the_time
  from candidate c
  where (c.the_date > v_now::date
         or (c.the_date = v_now::date and c.the_time > v_now::time))
    and not exists (
      select 1 from public.bookings b
      where b.date = c.the_date
        and b.time = c.the_time
        and b.status in ('pending','confirmed')
    )
  order by c.the_date, c.the_time;
end;
$$;

-- ----- request_booking: validates + inserts a pending booking -----
-- p_child_age / p_concern are the reference site's intake fields; they are stored
-- in contacts.details so the contract schema never changes per client. A client
-- with different intake fields adapts this signature + the details payload only.
create or replace function public.request_booking(
  p_name text,
  p_phone text,
  p_child_age int,
  p_branch text,
  p_concern text,
  p_slot_date date,
  p_slot_time time,
  p_language text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now        timestamp := (now() at time zone public.kit_timezone());
  v_contact_id uuid;
  v_booking_id uuid;
  v_ok         boolean;
begin
  -- 1. input validation
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 120
     or p_phone is null or length(trim(p_phone)) < 6
     or p_branch is null or length(trim(p_branch)) = 0 then
    return jsonb_build_object('status','invalid_input');
  end if;

  -- 2. slot must be in the future (client timezone)
  if p_slot_date < v_now::date
     or (p_slot_date = v_now::date and p_slot_time <= v_now::time) then
    return jsonb_build_object('status','invalid_slot');
  end if;

  -- 3. slot must fall within an active availability window for its weekday
  select exists (
    select 1 from public.availability a
    where a.active
      and a.weekday = extract(dow from p_slot_date)::int
      and p_slot_time >= a.start_time
      and p_slot_time <  a.end_time
  ) into v_ok;
  if not v_ok then
    return jsonb_build_object('status','invalid_slot');
  end if;

  -- 4. find-or-create contact by phone (dedupe leads)
  select id into v_contact_id
  from public.contacts
  where phone = p_phone
  order by created_at asc
  limit 1;

  if v_contact_id is null then
    insert into public.contacts (name, phone, branch, source_submission_id, details)
    values (
      trim(p_name), p_phone, p_branch, null,
      jsonb_strip_nulls(jsonb_build_object(
        'child_age', p_child_age,
        'concern',   nullif(trim(coalesce(p_concern,'')), '')
      ))
    )
    returning id into v_contact_id;
  end if;

  -- 5. insert booking; the partial unique index (0004) is the final race guard
  begin
    insert into public.bookings (contact_id, date, time, status, source, details)
    values (
      v_contact_id, p_slot_date, p_slot_time, 'pending', 'public',
      jsonb_strip_nulls(jsonb_build_object('language', nullif(p_language,'')))
    )
    returning id into v_booking_id;
  exception when unique_violation then
    return jsonb_build_object('status','slot_taken');
  end;

  return jsonb_build_object('status','ok','booking_id', v_booking_id);
end;
$$;

-- ----- reschedule_booking: admin-only; moves a booking + notifies both parties -----
-- A reschedule keeps status unchanged, so the status-change trigger (0007) does NOT
-- fire; this RPC enqueues the 'rescheduled' notifications directly.
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_slot_date  date,
  p_slot_time  time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now        timestamp := (now() at time zone public.kit_timezone());
  v_contact_id uuid;
  v_status     text;
  v_phone      text;
  v_name       text;
  v_staff      text;
  v_ok         boolean;
begin
  -- 1. auth: admins only
  if not public.has_role(auth.uid(), 'admin') then
    return jsonb_build_object('status','forbidden');
  end if;

  -- 2. load booking; only active bookings can be rescheduled
  select b.contact_id, b.status into v_contact_id, v_status
  from public.bookings b
  where b.id = p_booking_id;

  if v_contact_id is null or v_status not in ('pending','confirmed') then
    return jsonb_build_object('status','not_found');
  end if;

  -- 3. new slot must be in the future (client timezone)
  if p_slot_date < v_now::date
     or (p_slot_date = v_now::date and p_slot_time <= v_now::time) then
    return jsonb_build_object('status','invalid_slot');
  end if;

  -- 4. new slot must fall within an active availability window for its weekday
  select exists (
    select 1 from public.availability a
    where a.active
      and a.weekday = extract(dow from p_slot_date)::int
      and p_slot_time >= a.start_time
      and p_slot_time <  a.end_time
  ) into v_ok;
  if not v_ok then
    return jsonb_build_object('status','invalid_slot');
  end if;

  -- 5. new slot must be free (ignore THIS booking)
  if exists (
    select 1 from public.bookings b
    where b.date = p_slot_date
      and b.time = p_slot_time
      and b.status in ('pending','confirmed')
      and b.id <> p_booking_id
  ) then
    return jsonb_build_object('status','slot_taken');
  end if;

  -- 6. move the booking; unique index is the final race guard
  begin
    update public.bookings
    set date = p_slot_date, time = p_slot_time
    where id = p_booking_id;
  exception when unique_violation then
    return jsonb_build_object('status','slot_taken');
  end;

  -- 7. notify both parties with the NEW date/time
  select c.phone, c.name into v_phone, v_name
  from public.contacts c where c.id = v_contact_id;

  select value into v_staff
  from public.site_settings where key = 'notify_staff_phone';

  -- consultant (global staff phone)
  if coalesce(v_staff, '') <> '' then
    insert into public.notification_outbox (booking_id, event, recipient, to_phone, payload)
    values (p_booking_id, 'rescheduled', 'staff', v_staff,
            jsonb_build_object('name', v_name, 'date', p_slot_date,
                               'time', p_slot_time, 'status', v_status));
  end if;

  -- lead (parent)
  if coalesce(v_phone, '') <> '' then
    insert into public.notification_outbox (booking_id, event, recipient, to_phone, payload)
    values (p_booking_id, 'rescheduled', 'lead', v_phone,
            jsonb_build_object('name', v_name, 'date', p_slot_date,
                               'time', p_slot_time, 'status', v_status));
  end if;

  return jsonb_build_object('status','ok');
end;
$$;

-- ----- execute grants -----
-- anon's ONLY booking capabilities: read free slots + request a booking.
grant execute on function public.get_available_slots(date, date) to anon, authenticated;
grant execute on function public.request_booking(text, text, int, text, text, date, time, text) to anon, authenticated;
-- reschedule is logged-in admins only (the function self-checks has_role too).
grant execute on function public.reschedule_booking(uuid, date, time) to authenticated;
