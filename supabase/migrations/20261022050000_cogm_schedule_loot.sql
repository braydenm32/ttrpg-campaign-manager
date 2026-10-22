-- Co-GMs, session scheduling, page templates and party loot.
--  - Co-GMs: a second invite link makes whoever opens it a GM of the world. GMs already have full
--    access through is_world_gm(); only the owner manages members and links. The co-GM link lives
--    in its own owner-only table, because players can read their world's cloud_worlds row.
--  - Scheduling: the GM proposes dates on a campaign (synced like everything else); players answer
--    each one yes, maybe or no through set_availability(). Everyone in the world can see the answers.
--  - player_view: templates never reach players, and an item's holder is kept only when the viewer
--    can see that character (or it's the party stash).

create table if not exists public.gm_invites (
  world_id uuid primary key references public.cloud_worlds (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.gm_invites enable row level security;
create policy "owners manage co-gm links" on public.gm_invites for all to authenticated
  using (public.is_world_owner(world_id)) with check (public.is_world_owner(world_id));

-- Joining with either link. The player link makes you a player; the co-GM link makes you a GM
-- (and promotes you if you'd already joined as a player).
create or replace function public.join_world(token text, name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  wid uuid;
  as_role text;
  me uuid := auth.uid();
begin
  if me is null or token is null or length(token) < 20 then
    return null;
  end if;
  select id, 'player' into wid, as_role from public.cloud_worlds where invite_token = token;
  if wid is null then
    select world_id, 'gm' into wid, as_role from public.gm_invites g where g.token = join_world.token;
  end if;
  if wid is null then
    return null;
  end if;
  if public.is_world_gm(wid) then
    return wid;
  end if;
  insert into public.world_members (world_id, user_id, role, display_name)
  values (wid, me, as_role, left(coalesce(trim(name), ''), 60))
  on conflict (world_id, user_id) do update set
    role = case when excluded.role = 'gm' then 'gm' else public.world_members.role end,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.world_members.display_name end;
  return wid;
end $$;
revoke execute on function public.join_world(text, text) from public, anon;
grant execute on function public.join_world(text, text) to authenticated;

-- Players' answers to proposed session dates. option_id is the id of a date on a campaign.
create table if not exists public.availability (
  world_id uuid not null,
  option_id text not null,
  user_id uuid not null,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (world_id, option_id, user_id),
  foreign key (world_id, user_id) references public.world_members (world_id, user_id) on delete cascade
);
create trigger availability_touch before update on public.availability for each row execute function public.touch_updated_at();
alter table public.availability enable row level security;
create policy "gms read availability" on public.availability for select to authenticated using (public.is_world_gm(world_id));
-- Players read answers through member_world and write them through set_availability.

-- A member answers for themselves; a null answer takes it back.
create or replace function public.set_availability(wid uuid, option_id text, answer text) returns void
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = me) then
    raise exception 'Only players in this world can answer.';
  end if;
  if answer is null then
    delete from public.availability a where a.world_id = wid and a.option_id = set_availability.option_id and a.user_id = me;
    return;
  end if;
  insert into public.availability (world_id, option_id, user_id, answer)
  values (wid, left(set_availability.option_id, 100), me, answer)
  on conflict on constraint availability_pkey do update set answer = excluded.answer;
end $$;
revoke execute on function public.set_availability(uuid, text, text) from public, anon;
grant execute on function public.set_availability(uuid, text, text) to authenticated;

create or replace function public.player_view(wid uuid, viewer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  names text[] := case when viewer is null then '{}'::text[] else public.viewer_names(wid, viewer) end;
begin
  with live as (
    select table_name, id, data from public.records where world_id = wid and not deleted and data is not null
  ),
  -- Templates are the GM's starting points, never pages players should see.
  ents as (
    select id, data from live
    where table_name = 'entities' and public.entity_visible_to(data, viewer) and coalesce(data->>'template', '') <> 'true'
  ),
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
    'worldId', wid,
    'world', (select data - 'gmNotes' from live where table_name = 'worlds' and id = wid::text),
    'campaigns', coalesce((select jsonb_agg(data) from live where table_name = 'campaigns'), '[]'::jsonb),
    'entities', coalesce((select jsonb_agg(
        (data - 'revealedTo') || jsonb_build_object(
          'gmNotes', '',
          -- Pages revealed only to this viewer arrive as ordinary revealed pages, flagged so the app can say so.
          'visibility', 'players',
          'secretForYou', data->>'visibility' <> 'players',
          'body', public.player_text(data->>'body', names),
          'parentId', case when data->>'parentId' in (select id from ents) then data->'parentId' else 'null'::jsonb end,
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end,
          -- Who carries an item: the party, or a character the viewer can see.
          'heldBy', case when data->>'heldBy' = 'party' or data->>'heldBy' in (select id from ents) then data->'heldBy' else 'null'::jsonb end
        )) from ents), '[]'::jsonb),
    'maps', coalesce((select jsonb_agg(
        (data - 'drawing') || jsonb_build_object(
          'locationId', case when data->>'locationId' in (select id from ents) then data->'locationId' else 'null'::jsonb end
        )) from maps), '[]'::jsonb),
    'pins', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'note', public.player_text(data->>'note', names),
          'entityId', case when data->>'entityId' in (select id from ents) then data->'entityId' else 'null'::jsonb end,
          'childMapId', case when data->>'childMapId' in (select id from maps) then data->'childMapId' else 'null'::jsonb end
        )) from pins), '[]'::jsonb),
    -- Sessions are rebuilt from a list of player-safe fields, so GM-only additions (notes, recordings,
    -- transcripts, recap drafts, the Lectern) can never slip through.
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
          'id', to_jsonb(id),
          'worldId', data->'worldId',
          'campaignId', data->'campaignId',
          'number', data->'number',
          'title', data->'title',
          'date', data->'date',
          'visibility', data->'visibility',
          'createdAt', data->'createdAt',
          'recap', public.player_text(data->>'recap', names),
          'notes', '',
          'recordings', '[]'::jsonb,
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid, uuid) from public, anon, authenticated;

-- The world for one member, now with everyone's answers to proposed dates.
create or replace function public.member_world(wid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_world_member(wid) then
    return null;
  end if;
  return public.player_view(wid, me) || jsonb_build_object(
    'me', me,
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', m.display_name, 'role', m.role))
      from public.world_members m where m.world_id = wid), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('entityId', c.entity_id, 'userId', c.user_id, 'notes', c.player_notes))
      from public.character_claims c where c.world_id = wid and public.claimable_character(wid, c.entity_id, me)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
        'entityId', n.entity_id, 'shared', n.scope = 'group', 'body', n.body, 'updatedBy', n.updated_by, 'updatedAt', n.updated_at))
      from public.player_notes n
      where n.world_id = wid and (n.scope = 'group' or n.scope = me::text)
        and (n.entity_id = '' or exists (
          select 1 from public.records r where r.world_id = wid and r.table_name = 'entities' and r.id = n.entity_id
            and not r.deleted and public.entity_visible_to(r.data, me)))), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(jsonb_build_object('optionId', a.option_id, 'userId', a.user_id, 'answer', a.answer))
      from public.availability a where a.world_id = wid), '[]'::jsonb)
  );
end $$;

