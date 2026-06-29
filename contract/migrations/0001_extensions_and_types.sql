-- booking-crm-kit · 0001 · extensions + enum types
-- Idempotent: safe to re-run on a fresh or partially-built database.

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- Role enum used by user_roles + has_role(). Guarded create so re-runs are no-ops.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin');
  end if;
end $$;
