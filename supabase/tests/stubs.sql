-- Stand-ins for the parts of Supabase that supabase/migrations use, so they load on a plain
-- Postgres 16 or newer. Run once, as a superuser, on an empty database owned by "postgres".
-- Not a copy of Supabase: just enough that the migrations and the security rules behave alike.
--  - postgres owns the app's tables and is NOT a superuser (as on Supabase), but skips row security.
--  - anon / authenticated are what a signed-out / signed-in caller runs as; auth.uid() reads the
--    signed-in user's id from the setting request.jwt.claim.sub, as PostgREST sets it.
--  - service_role is the edge function's own key (skips row security).
\set ON_ERROR_STOP on
-- Quiet about what doesn't matter here (a scratch server can't stream changes to Realtime, say).
set client_min_messages = error;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login createrole bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
grant anon, authenticated, service_role to postgres;

-- What Supabase grants on new things in public (the reason for PRIV-10).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------- auth ----------
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant execute on function auth.uid() to postgres, anon, authenticated, service_role;
grant select, insert, update, delete, references on auth.users to postgres;

-- ---------- storage ----------
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
-- Supabase's own definition.
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
-- The migrations add policies here, as they can on Supabase.
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to postgres, anon, authenticated, service_role;

-- ---------- realtime ----------
create schema realtime;
create table realtime.messages (
  id bigserial primary key,
  topic text not null default '',
  extension text not null default 'broadcast',
  payload jsonb,
  event text,
  private boolean default false,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
alter table realtime.messages owner to postgres;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')::text
$$;
grant usage on schema realtime to postgres, anon, authenticated, service_role;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on sequence realtime.messages_id_seq to anon, authenticated;
grant execute on function realtime.topic() to postgres, anon, authenticated, service_role;

create publication supabase_realtime;
alter publication supabase_realtime owner to postgres;
