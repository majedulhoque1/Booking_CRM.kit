-- TEST-ONLY shims — NOT part of the contract. Do NOT apply to a real Supabase DB.
-- Supabase provides the auth schema, auth.uid(), and the anon/authenticated/service_role
-- roles. To verify the contract on a bare Postgres we stub just enough of them.
-- Guarded by APPLY_TEST_SHIMS=1 in verify-contract.sh so it never runs against Supabase.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Settable current-user stub: a test does `select set_config('app.current_uid', '<uuid>', true)`
-- to exercise admin-gated paths; unset → NULL (anon).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_uid', true), '')::uuid;
$$;
