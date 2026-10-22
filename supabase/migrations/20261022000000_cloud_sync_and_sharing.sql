-- Campaign Codex cloud: sync between a GM's devices, and read-only player share links.
-- Applied to project ysrxumagiiaoihlhofqt (campaign-codex, Sydney) on 2026-10-22. This file is the
-- combined final state of the migrations applied that day, kept here for reference and for new projects.

create table public.cloud_worlds (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: players joining a campaign. GMs listed here get full access too.
create table public.world_members (
  world_id uuid not null references public.cloud_worlds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('gm', 'player')),
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

-- Every synced row of every local table, stored as JSON. Deletes are kept as tombstones so other devices see them.
create table public.records (
  world_id uuid not null references public.cloud_worlds (id) on delete cascade,
  table_name text not null check (table_name in ('worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (table_name, id)
);
create index records_world_updated on public.records (world_id, updated_at);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger records_touch before insert or update on public.records for each row execute function public.touch_updated_at();
create trigger cloud_worlds_touch before update on public.cloud_worlds for each row execute function public.touch_updated_at();

-- Access helpers. SECURITY DEFINER so policies on cloud_worlds and world_members can refer to each other without recursion.
create function public.is_world_owner(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cloud_worlds c where c.id = w and c.owner = (select auth.uid()))
$$;
create function public.is_world_member(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.world_members m where m.world_id = w and m.user_id = (select auth.uid()))
$$;
create function public.is_world_gm(w uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cloud_worlds c where c.id = w and c.owner = (select auth.uid()))
      or exists (select 1 from public.world_members m where m.world_id = w and m.user_id = (select auth.uid()) and m.role = 'gm')
$$;
revoke execute on function public.is_world_owner(uuid), public.is_world_member(uuid), public.is_world_gm(uuid) from anon, public;
grant execute on function public.is_world_owner(uuid), public.is_world_member(uuid), public.is_world_gm(uuid) to authenticated;

alter table public.cloud_worlds enable row level security;
alter table public.world_members enable row level security;
alter table public.records enable row level security;

create policy "owners manage their worlds" on public.cloud_worlds for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "members can see worlds they belong to" on public.cloud_worlds for select to authenticated
  using (public.is_world_member(id));

create policy "owners manage members" on public.world_members for all to authenticated
  using (public.is_world_owner(world_id)) with check (public.is_world_owner(world_id));
create policy "members see their own membership" on public.world_members for select to authenticated
  using (user_id = (select auth.uid()));

-- Only GMs can read or write raw records. Players never read this table directly.
create policy "gms read records" on public.records for select to authenticated using (public.is_world_gm(world_id));
create policy "gms insert records" on public.records for insert to authenticated with check (public.is_world_gm(world_id));
create policy "gms update records" on public.records for update to authenticated using (public.is_world_gm(world_id)) with check (public.is_world_gm(world_id));
create policy "gms delete records" on public.records for delete to authenticated using (public.is_world_gm(world_id));

-- Removes :::gm ... ::: secret blocks, matching GM_BLOCK in src/Markdown.tsx. An unclosed block hides the rest of the text.
-- The first quantifier is non-greedy, which makes the whole Postgres pattern non-greedy (one block per match).
create function public.strip_gm_blocks(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(t, ''), '^:::gm[ \t]*?(?:\n[^\n]*)*?(?:\n:::[ \t]*$|\Z)', '', 'gn')
$$;

-- The player-safe view of a shared world. Everything GM-only is filtered or blanked here, on the server.
create function public.shared_world(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w public.cloud_worlds;
  result jsonb;
begin
  if token is null or length(token) < 20 then
    return null;
  end if;
  select * into w from public.cloud_worlds where share_token = token;
  if not found then
    return null;
  end if;

  with live as (
    select table_name, id, data from public.records where world_id = w.id and not deleted and data is not null
  ),
  ents as (select id, data from live where table_name = 'entities' and data->>'visibility' = 'players'),
  maps as (select id, data from live where table_name = 'maps' and data->>'visibility' = 'players'),
  ses as (select id, data from live where table_name = 'sessions' and data->>'visibility' = 'players'),
  pins as (
    select p.id, p.data from live p
    where p.table_name = 'pins' and p.data->>'visibility' = 'players' and p.data->>'mapId' in (select id from maps)
  ),
  assets as (
    select id, data from live a where a.table_name = 'assets' and (
      a.data->>'visibility' = 'players'
      or a.id in (select data->>'imageId' from ents)
      or a.id in (select data->>'imageId' from maps)
    )
  )
  select jsonb_build_object(
    'worldId', w.id,
    'world', (select data - 'gmNotes' from live where table_name = 'worlds' and id = w.id::text),
    'campaigns', coalesce((select jsonb_agg(data) from live where table_name = 'campaigns'), '[]'::jsonb),
    'entities', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'gmNotes', '',
          'body', public.strip_gm_blocks(data->>'body'),
          'parentId', case when data->>'parentId' in (select id from ents) then data->'parentId' else 'null'::jsonb end,
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end
        )) from ents), '[]'::jsonb),
    'maps', coalesce((select jsonb_agg(
        (data - 'drawing') || jsonb_build_object(
          'locationId', case when data->>'locationId' in (select id from ents) then data->'locationId' else 'null'::jsonb end
        )) from maps), '[]'::jsonb),
    'pins', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'note', public.strip_gm_blocks(data->>'note'),
          'entityId', case when data->>'entityId' in (select id from ents) then data->'entityId' else 'null'::jsonb end,
          'childMapId', case when data->>'childMapId' in (select id from maps) then data->'childMapId' else 'null'::jsonb end
        )) from pins), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'notes', '',
          'recordings', '[]'::jsonb,
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = w.id)
  ) into result;
  return result;
end $$;
revoke execute on function public.shared_world(text) from public;
grant execute on function public.shared_world(text) to anon, authenticated;

-- Private storage for uploaded files. Path: <world id>/<asset id>. Shared files are served by the shared-asset edge function.
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict (id) do nothing;
create policy "gms read world files" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and public.is_world_gm(((storage.foldername(name))[1])::uuid));
create policy "gms upload world files" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.is_world_gm(((storage.foldername(name))[1])::uuid));
create policy "gms replace world files" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and public.is_world_gm(((storage.foldername(name))[1])::uuid));
create policy "gms delete world files" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.is_world_gm(((storage.foldername(name))[1])::uuid));

-- Live updates for GMs on other devices.
alter publication supabase_realtime add table public.records;
