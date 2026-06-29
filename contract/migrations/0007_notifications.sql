-- booking-crm-kit · 0007 · booking notification routing
-- Enqueues outbox rows on booking lifecycle changes; the send-notifications edge
-- function drains them via a pluggable provider (NOTIFY_PROVIDER). Routing:
--   • staff (notify_staff_phone) are alerted on a NEW request and on CONFIRM
--   • the lead (contact phone) is messaged on CONFIRM and on CANCEL
-- The notification_outbox.recipient column + notify_staff_phone setting already
-- exist (0004 / 0002). Idempotent.

create or replace function public.enqueue_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_phone text;
  v_name  text;
  v_staff text;
begin
  if (tg_op = 'INSERT') then
    v_event := 'requested';
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status = 'confirmed' then v_event := 'confirmed';
    elsif new.status = 'cancelled' then v_event := 'cancelled';
    else return new; end if;
  else
    return new;
  end if;

  select c.phone, c.name into v_phone, v_name
  from public.contacts c where c.id = new.contact_id;

  select value into v_staff
  from public.site_settings where key = 'notify_staff_phone';

  -- Staff alert: new request + confirmation
  if v_event in ('requested', 'confirmed') and coalesce(v_staff, '') <> '' then
    insert into public.notification_outbox (booking_id, event, recipient, to_phone, payload)
    values (new.id, v_event, 'staff', v_staff,
            jsonb_build_object('name', v_name, 'date', new.date,
                               'time', new.time, 'status', new.status));
  end if;

  -- Lead (parent) message: confirmation + cancellation
  if v_event in ('confirmed', 'cancelled') and coalesce(v_phone, '') <> '' then
    insert into public.notification_outbox (booking_id, event, recipient, to_phone, payload)
    values (new.id, v_event, 'lead', v_phone,
            jsonb_build_object('name', v_name, 'date', new.date,
                               'time', new.time, 'status', new.status));
  end if;

  return new;
end;
$$;

-- Fire on insert and on status transitions only (reschedule changes date/time, not
-- status, so it intentionally bypasses this trigger and notifies inside the RPC).
drop trigger if exists trg_booking_notification on public.bookings;
create trigger trg_booking_notification
  after insert or update of status on public.bookings
  for each row execute function public.enqueue_booking_notification();
