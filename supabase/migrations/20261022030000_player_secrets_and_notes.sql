-- Secrets for particular players, and players' own notes.
--  - A GM-only page can be revealed to chosen players (entity data "revealedTo": [user ids]).
--  - A passage between ":::for Wren, Kael" and ":::" is kept only for the players who have claimed
--    one of the characters listed, by full or first name (not table names: players choose those).
--    Kept passages reach them marked ":::foryou"; everyone else never gets them.
--  - Players keep notes on any page they can see, privately or shared with the group, plus a
--    world-wide scratchpad (entity_id '').

-- Player-safe text for one viewer: drops :::gm passages, and :::for passages not meant for them.
-- An unclosed block hides the rest of the text, like strip_gm_blocks.
create function public.player_text(t text, names text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  line text;
  result text[] := '{}';
  mode text := null; -- null: normal, 'skip': inside a hidden block, 'keep': inside a passage for this viewer
  wanted text[] := coalesce((select array_agg(lower(trim(n))) from unnest(names) n), '{}');
begin
  if t is null then
    return '';
  end if;
  foreach line in array string_to_array(t, E'\n') loop
    if mode is null then
      if line ~ '^:::gm[ \t]*$' then
        mode := 'skip';
      elsif line ~ '^:::for[ \t]+\S' then
        if exists (
          select 1 from unnest(string_to_array(regexp_replace(line, '^:::for[ \t]+', ''), ',')) n
          where lower(trim(n)) = any (wanted) and trim(n) <> ''
        ) then
          mode := 'keep';
          result := result || ':::foryou'::text;
        else
          mode := 'skip';
        end if;
      else
        result := result || line;
      end if;
    elsif line ~ '^:::[ \t]*$' then
      if mode = 'keep' then
        result := result || line;
      end if;
      mode := null;
    elsif mode = 'keep' then
      result := result || line;
    end if;
  end loop;
  return array_to_string(result, E'\n');
end $$;

-- Can this viewer see this page? Revealed to everyone, or to them in particular.
create function public.entity_visible_to(data jsonb, viewer uuid) returns boolean
language sql immutable set search_path = '' as $$
  select data->>'visibility' = 'players'
      or (viewer is not null and coalesce(data->'revealedTo', '[]'::jsonb) ? viewer::text)
$$;

-- The names a viewer answers to in ":::for" passages: the characters they've claimed, by full name
-- or first name ("Wren" for Wren Thistle). Table names don't count, because players pick those
-- themselves and could pick someone else's.
create function public.viewer_names(wid uuid, viewer uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct n), '{}') from public.character_claims c
    join public.records r on r.world_id = c.world_id and r.table_name = 'entities' and r.id = c.entity_id and not r.deleted
    cross join lateral (values (trim(r.data->>'name')), (split_part(trim(r.data->>'name'), ' ', 1))) v(n)
  where c.world_id = wid and c.user_id = viewer and n <> ''
$$;
revoke execute on function public.viewer_names(uuid, uuid) from public, anon, authenticated;

-- The old one-argument player_view(wid) and claimable_character(wid, eid) are left in place, unused
-- and not callable from the app (execute was revoked when they were made).
create function public.player_view(wid uuid, viewer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  names text[] := case when viewer is null then '{}'::text[] else public.viewer_names(wid, viewer) end;
begin
  with live as (
    select table_name, id, data from public.records where world_id = wid and not deleted and data is not null
  ),
  ents as (select id, data from live where table_name = 'entities' and public.entity_visible_to(data, viewer)),
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
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end
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

-- Players can claim characters revealed to everyone or to them in particular.
create function public.claimable_character(wid uuid, eid text, viewer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.records r
    where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted
      and r.data->>'type' = 'pc' and public.entity_visible_to(r.data, viewer)
  )
$$;
revoke execute on function public.claimable_character(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.claim_character(wid uuid, eid text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  holder uuid;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = auth.uid() and m.role = 'player') then
    raise exception 'Only players in this world can claim a character.';
  end if;
  if not public.claimable_character(wid, eid, auth.uid()) then
    raise exception 'That character isn''t available to claim.';
  end if;
  select user_id into holder from public.character_claims where world_id = wid and entity_id = eid;
  if holder is not null and holder <> auth.uid() then
    raise exception 'Someone else already plays that character.';
  end if;
  insert into public.character_claims (world_id, entity_id, user_id) values (wid, eid, auth.uid())
  on conflict (world_id, entity_id) do nothing;
end $$;

-- Players' notes. scope is 'group' (every player in the world, and the GM, can read it) or the
-- owner's user id (only that player). entity_id '' is the world's scratchpad.
create table public.player_notes (
  world_id uuid not null references public.cloud_worlds (id) on delete cascade,
  entity_id text not null,
  scope text not null,
  body text not null default '',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (world_id, entity_id, scope)
);
create trigger player_notes_touch before update on public.player_notes for each row execute function public.touch_updated_at();
alter table public.player_notes enable row level security;
create policy "gms read group notes" on public.player_notes for select to authenticated
  using (scope = 'group' and public.is_world_gm(world_id));
-- Players read notes only through member_world, which leaves out notes on pages they can't see.

-- A player's private notes go when they leave or are removed.
create function public.drop_member_notes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.player_notes where world_id = old.world_id and scope = old.user_id::text;
  return old;
end $$;
revoke execute on function public.drop_member_notes() from public, anon, authenticated;
create trigger world_members_drop_notes after delete on public.world_members for each row execute function public.drop_member_notes();

create function public.save_player_note(wid uuid, eid text, shared boolean, body text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d jsonb;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = me and m.role = 'player') then
    raise exception 'Only players in this world can write notes here.';
  end if;
  if eid <> '' then
    select r.data into d from public.records r where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted;
    if d is null or not public.entity_visible_to(d, me) then
      raise exception 'That page isn''t available.';
    end if;
  end if;
  insert into public.player_notes (world_id, entity_id, scope, body, updated_by)
  values (wid, eid, case when shared then 'group' else me::text end, left(coalesce(body, ''), 50000), me)
  on conflict (world_id, entity_id, scope) do update set body = excluded.body, updated_by = excluded.updated_by;
end $$;
revoke execute on function public.save_player_note(uuid, text, boolean, text) from public, anon;
grant execute on function public.save_player_note(uuid, text, boolean, text) to authenticated;

-- The world for one member: filtered for them, with claims and the notes they may read.
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
            and not r.deleted and public.entity_visible_to(r.data, me)))), '[]'::jsonb)
  );
end $$;

-- Share links: no viewer, so only pages revealed to everyone and no ":::for" passages.
create or replace function public.shared_world(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  wid uuid;
begin
  if token is null or length(token) < 20 then
    return null;
  end if;
  select id into wid from public.cloud_worlds where share_token = token;
  if wid is null then
    return null;
  end if;
  return public.player_view(wid, null);
end $$;
