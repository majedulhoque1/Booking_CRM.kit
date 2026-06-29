-- booking-crm-kit · 0008 · Row-Level Security for every table (the access boundary)
-- Model:
--   • anon  → no direct table reads. Booking goes through the SECURITY DEFINER RPCs
--             (0005); the only direct anon write is INSERT into inquiries (contact form).
--   • authenticated admins (has_role(auth.uid(),'admin')) → full read/write on the
--             operational tables.
--   • analytics_events → deny-all (no policy). service_role inserts (bypasses RLS);
--             admins read only via the analytics_* RPCs (0006).
--   • service_role → bypasses RLS; granted explicitly where the edge function/worker needs it.
-- Idempotent: enable-RLS is a no-op if already on; every policy is drop-then-create.

-- ===================== kit_meta: world-readable version stamp =====================
alter table public.kit_meta enable row level security;
grant select on public.kit_meta to anon, authenticated;
drop policy if exists kit_meta_read on public.kit_meta;
create policy kit_meta_read on public.kit_meta for select using (true);

-- ===================== site_settings: admin-managed config =====================
-- The RPCs read it via SECURITY DEFINER (bypass RLS); only admins touch it via the API.
alter table public.site_settings enable row level security;
grant select, insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== profiles: self + admin read =====================
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists profiles_self_or_admin_read on public.profiles;
create policy profiles_self_or_admin_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===================== user_roles: self read, admin manage =====================
alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_roles_admin_manage on public.user_roles;
create policy user_roles_admin_manage on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== availability: public read, admin write =====================
alter table public.availability enable row level security;
grant select on public.availability to anon, authenticated;
grant insert, update, delete on public.availability to authenticated;
grant all on public.availability to service_role;
drop policy if exists availability_public_read on public.availability;
create policy availability_public_read on public.availability
  for select to anon, authenticated using (true);
drop policy if exists availability_admin_write on public.availability;
create policy availability_admin_write on public.availability
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== contacts: admin-only; never anon =====================
-- request_booking writes via SECURITY DEFINER, so no anon grants are needed here.
revoke all on public.contacts from anon;
alter table public.contacts enable row level security;
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
drop policy if exists contacts_admin_all on public.contacts;
create policy contacts_admin_all on public.contacts
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== bookings: admin-only; never anon =====================
-- Public bookings are created only through request_booking (SECURITY DEFINER).
revoke all on public.bookings from anon;
alter table public.bookings enable row level security;
grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== inquiries: anon INSERT-only, admin reads/manages =====================
alter table public.inquiries enable row level security;
grant insert on public.inquiries to anon, authenticated;
grant select, update, delete on public.inquiries to authenticated;
grant all on public.inquiries to service_role;
drop policy if exists inquiries_anon_insert on public.inquiries;
create policy inquiries_anon_insert on public.inquiries
  for insert to anon, authenticated with check (true);
drop policy if exists inquiries_admin_read on public.inquiries;
create policy inquiries_admin_read on public.inquiries
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists inquiries_admin_manage on public.inquiries;
create policy inquiries_admin_manage on public.inquiries
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===================== notification_outbox: admin read; service_role drains =====================
revoke all on public.notification_outbox from anon;
alter table public.notification_outbox enable row level security;
grant select on public.notification_outbox to authenticated;
grant all on public.notification_outbox to service_role;
drop policy if exists outbox_admin_read on public.notification_outbox;
create policy outbox_admin_read on public.notification_outbox
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ===================== analytics_events: DENY-ALL to anon/authenticated =====================
-- RLS on with NO policy = no row is ever visible/writable via anon or authenticated.
-- The collector worker inserts with the service role (bypasses RLS); admins read
-- exclusively through the analytics_* RPCs (0006, SECURITY DEFINER).
revoke all on public.analytics_events from anon, authenticated;
alter table public.analytics_events enable row level security;
grant insert on public.analytics_events to service_role;
grant all on public.analytics_events to service_role;
