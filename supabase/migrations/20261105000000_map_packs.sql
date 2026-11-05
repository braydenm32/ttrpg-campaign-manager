-- Map packs: the GM's own map pieces (pictures they made or bought), uploaded once and switched on
-- for any of their campaigns (src/packs/). Each piece is stored once, however many worlds use it.
--  - map_packs, map_pack_pieces: a pack and its pieces (name, group, size on the grid, versions).
--    Only the owner can add or change them.
--  - world_packs: which packs a synced world has switched on, so the world's co-GMs can read (never
--    change) those pieces and draw its maps too.
--  - storage bucket "map-packs": the pictures, at <owner>/<piece>/<rev>-<version>-<full|thumb>.<ext>.
--    Private: the owner, and GMs of a world with the pack on, can read them.
-- Players never read any of this: they get the finished map picture, as before. player_view is
-- unchanged (a world's list of packs lives in gmScreen, which it never sends).
-- Safe to run more than once; the app works before it (packs then stay on the GM's device).

create table if not exists public.map_packs (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_pack_pieces (
  id uuid primary key,
  pack_id uuid not null references public.map_packs on delete cascade,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  -- label, group, scene, size, light, versions (sizes and file types), hidden
  data jsonb not null default '{}'::jsonb,
  -- goes up each time the piece gets new pictures; older pictures stay for the maps that use them
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists map_pack_pieces_pack on public.map_pack_pieces (pack_id);

create table if not exists public.world_packs (
  world_id uuid not null references public.cloud_worlds on delete cascade,
  pack_id uuid not null references public.map_packs on delete cascade,
  added_by uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (world_id, pack_id)
);
create index if not exists world_packs_pack on public.world_packs (pack_id);

alter table public.map_packs enable row level security;
alter table public.map_pack_pieces enable row level security;
alter table public.world_packs enable row level security;

-- Can the signed-in person read this pack? Its owner, or a GM of a world that has it switched on.
create or replace function public.can_read_pack(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.map_packs k where k.id = p and k.owner = (select auth.uid()))
      or exists (select 1 from public.world_packs wp where wp.pack_id = p and public.is_world_gm(wp.world_id))
$$;
-- The same for one piece (the pictures are filed by piece).
create or replace function public.can_read_pack_piece(piece uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.map_pack_pieces x where x.id = piece and public.can_read_pack(x.pack_id))
$$;
revoke execute on function public.can_read_pack(uuid), public.can_read_pack_piece(uuid) from anon, public;
grant execute on function public.can_read_pack(uuid), public.can_read_pack_piece(uuid) to authenticated;

drop policy if exists "owners manage their packs" on public.map_packs;
create policy "owners manage their packs" on public.map_packs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists "world gms read packs on their worlds" on public.map_packs;
create policy "world gms read packs on their worlds" on public.map_packs for select to authenticated
  using (public.can_read_pack(id));

drop policy if exists "owners manage their pieces" on public.map_pack_pieces;
create policy "owners manage their pieces" on public.map_pack_pieces for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and exists (select 1 from public.map_packs k where k.id = pack_id and k.owner = (select auth.uid())));
drop policy if exists "world gms read pieces on their worlds" on public.map_pack_pieces;
create policy "world gms read pieces on their worlds" on public.map_pack_pieces for select to authenticated
  using (public.can_read_pack(pack_id));

-- A pack goes on a world only by its owner, and only on a world they're a GM of.
drop policy if exists "world gms see their worlds' packs" on public.world_packs;
create policy "world gms see their worlds' packs" on public.world_packs for select to authenticated
  using (public.is_world_gm(world_id));
drop policy if exists "pack owners switch packs on" on public.world_packs;
create policy "pack owners switch packs on" on public.world_packs for insert to authenticated
  with check (public.is_world_gm(world_id) and exists (select 1 from public.map_packs k where k.id = pack_id and k.owner = (select auth.uid())));
drop policy if exists "world gms switch packs off" on public.world_packs;
create policy "world gms switch packs off" on public.world_packs for delete to authenticated
  using (public.is_world_gm(world_id));

-- ---------- the pictures ----------

insert into storage.buckets (id, name, public) values ('map-packs', 'map-packs', false)
  on conflict (id) do nothing;

drop policy if exists "pack owners and world gms read pack pictures" on storage.objects;
create policy "pack owners and world gms read pack pictures" on storage.objects for select to authenticated
  using (bucket_id = 'map-packs' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.can_read_pack_piece(((storage.foldername(name))[2])::uuid)
  ));
drop policy if exists "pack owners upload pack pictures" on storage.objects;
create policy "pack owners upload pack pictures" on storage.objects for insert to authenticated
  with check (bucket_id = 'map-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "pack owners replace pack pictures" on storage.objects;
create policy "pack owners replace pack pictures" on storage.objects for update to authenticated
  using (bucket_id = 'map-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "pack owners delete pack pictures" on storage.objects;
create policy "pack owners delete pack pictures" on storage.objects for delete to authenticated
  using (bucket_id = 'map-packs' and (storage.foldername(name))[1] = (select auth.uid())::text);
