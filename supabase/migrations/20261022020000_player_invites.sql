-- Players join a world with an invite link and can claim a player character as theirs.
-- Players never read public.records: everything they get comes from public.player_view(), the same
-- player-safe filter that share links use, so GM-only content is removed on the server.

alter table public.cloud_worlds add column invite_token text unique;
alter table public.world_members add column display_name text not null default '';

-- Who plays which player character. Only changed through the functions below.
create table public.character_claims (
  world_id uuid not null,
  entity_id text not null,
  user_id uuid not null,
  player_notes text not null default '',
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (world_id, entity_id),
  -- Leaving (or being removed from) a world lets go of the character too.
  foreign key (world_id, user_id) references public.world_members (world_id, user_id) on delete cascade
);
create trigger character_claims_touch before update on public.character_claims for each row execute function public.touch_updated_at();
alter table public.character_claims enable row level security;
create policy "gms see claims" on public.character_claims for select to authenticated using (public.is_world_gm(world_id));
create policy "gms release claims" on public.character_claims for delete to authenticated using (public.is_world_gm(world_id));
create policy "members see claims in their worlds" on public.character_claims for select to authenticated
  using (public.is_world_member(world_id));

-- Members may leave a world themselves.
create policy "members leave worlds" on public.world_members for delete to authenticated using (user_id = (select auth.uid()));
-- Members of a world can see each other's names (to show who plays whom).
create policy "members see fellow members" on public.world_members for select to authenticated
  using (public.is_world_member(world_id));

-- The player-safe contents of a world. Internal: only called by the functions below.
create function public.player_view(wid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  with live as (
    select table_name, id, data from public.records where world_id = wid and not deleted and data is not null
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
    'worldId', wid,
    'world', (select data - 'gmNotes' from live where table_name = 'worlds' and id = wid::text),
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
    -- Sessions are rebuilt from a list of player-safe fields, so GM-only additions (notes, recordings,
    -- transcripts, recap drafts, the Lectern) can never slip through. The recap also loses any :::gm passages.
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
          'id', to_jsonb(id),
          'worldId', data->'worldId',
          'campaignId', data->'campaignId',
          'number', data->'number',
          'title', data->'title',
          'date', data->'date',
          'visibility', data->'visibility',
          'createdAt', data->'createdAt',
          'recap', public.strip_gm_blocks(data->>'recap'),
          'notes', '',
          'recordings', '[]'::jsonb,
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid) from public, anon, authenticated;

-- Share links: unchanged behaviour, now built on player_view().
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
  return public.player_view(wid);
end $$;
revoke execute on function public.shared_world(text) from public;
grant execute on function public.shared_world(text) to anon, authenticated;

-- A player character that players are allowed to see, and so may claim.
create function public.claimable_character(wid uuid, eid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.records r
    where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted
      and r.data->>'type' = 'pc' and r.data->>'visibility' = 'players'
  )
$$;
revoke execute on function public.claimable_character(uuid, text) from public, anon, authenticated;

-- Joining with an invite link. Returns the world id, or null if the link is wrong or turned off.
create function public.join_world(token text, name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  wid uuid;
  me uuid := auth.uid();
begin
  if me is null or token is null or length(token) < 20 then
    return null;
  end if;
  select id into wid from public.cloud_worlds where invite_token = token;
  if wid is null then
    return null;
  end if;
  if public.is_world_gm(wid) then
    return wid;
  end if;
  insert into public.world_members (world_id, user_id, role, display_name)
  values (wid, me, 'player', left(coalesce(trim(name), ''), 60))
  on conflict (world_id, user_id) do update set display_name = excluded.display_name
    where excluded.display_name <> '';
  return wid;
end $$;
revoke execute on function public.join_world(text, text) from public, anon;
grant execute on function public.join_world(text, text) to authenticated;

-- The player-safe world for a member, plus who plays which character.
create function public.member_world(wid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_world_member(wid) then
    return null;
  end if;
  return public.player_view(wid) || jsonb_build_object(
    'me', auth.uid(),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', m.display_name, 'role', m.role))
      from public.world_members m where m.world_id = wid), '[]'::jsonb),
    -- Only claims on characters players can see; a hidden character's claim stays hidden.
    'claims', coalesce((select jsonb_agg(jsonb_build_object('entityId', c.entity_id, 'userId', c.user_id, 'notes', c.player_notes))
      from public.character_claims c where c.world_id = wid and public.claimable_character(wid, c.entity_id)), '[]'::jsonb)
  );
end $$;
revoke execute on function public.member_world(uuid) from public, anon;
grant execute on function public.member_world(uuid) to authenticated;

create function public.claim_character(wid uuid, eid text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  holder uuid;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = auth.uid() and m.role = 'player') then
    raise exception 'Only players in this world can claim a character.';
  end if;
  if not public.claimable_character(wid, eid) then
    raise exception 'That character isn''t available to claim.';
  end if;
  select user_id into holder from public.character_claims where world_id = wid and entity_id = eid;
  if holder is not null and holder <> auth.uid() then
    raise exception 'Someone else already plays that character.';
  end if;
  insert into public.character_claims (world_id, entity_id, user_id) values (wid, eid, auth.uid())
  on conflict (world_id, entity_id) do nothing;
end $$;
revoke execute on function public.claim_character(uuid, text) from public, anon;
grant execute on function public.claim_character(uuid, text) to authenticated;

-- Letting go of a character: the player who holds it, or the GM.
create function public.release_character(wid uuid, eid text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.character_claims
  where world_id = wid and entity_id = eid and (user_id = auth.uid() or public.is_world_gm(wid));
end $$;
revoke execute on function public.release_character(uuid, text) from public, anon;
grant execute on function public.release_character(uuid, text) to authenticated;

-- The player's own notes on their character (backstory, goals). Readable by the GM and the table.
create function public.set_player_notes(wid uuid, eid text, notes text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.character_claims set player_notes = left(coalesce(notes, ''), 20000)
  where world_id = wid and entity_id = eid and user_id = auth.uid();
end $$;
revoke execute on function public.set_player_notes(uuid, text, text) from public, anon;
grant execute on function public.set_player_notes(uuid, text, text) to authenticated;
