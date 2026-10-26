-- Round two of the October 2026 review.
--  - Players can no longer read character_claims directly (an old rule allowed it). They get the
--    claims they may see through member_world(), as before.
--  - A public wiki link no longer gets the safety tools, the session schedule, or anything the GM
--    shows at the table (which could be a GM-only picture). Joined players still get those.
--  - Handouts: things the GM showed earlier stay readable for joined players (world.handouts).
--  - Group notes: saving checks nobody else changed the note meanwhile, and hands back theirs if so.
--  - The X-card is kept (without a name) so the GM sees a tap made while their app was closed.
--  - Live channels (X-card, "something changed") are private to the world. Turn off "Allow public
--    access" in Realtime settings once the app using private channels is live.
--  - ping() for the weekly keep-alive that stops the free project falling asleep.
-- Builds on 20261025010000_features.sql.

drop policy if exists "members see claims in their worlds" on public.character_claims;

create or replace function public.player_view(wid uuid, viewer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  names text[] := case when viewer is null then '{}'::text[] else public.viewer_names(wid, viewer) end;
begin
  with live as (
    select table_name, id, data from public.records where world_id = wid and not deleted and data is not null
  ),
  wrow as (select data from live where table_name = 'worlds' and id = wid::text),
  -- A campaign the GM keeps hidden (one they're planning, say) and its sessions stay GM-only.
  camps as (select id, data from live where table_name = 'campaigns' and coalesce(data->>'visibility', 'players') = 'players'),
  -- Templates are the GM's starting points, never pages players should see.
  ents as (
    select id, data from live
    where table_name = 'entities' and public.entity_visible_to(data, viewer) and coalesce(data->>'template', '') <> 'true'
  ),
  -- A fogged map only goes out once its fogged picture exists.
  maps as (
    select id, data from live
    where table_name = 'maps' and data->>'visibility' = 'players'
      and (coalesce(data->'fog'->>'on', '') <> 'true' or coalesce(data->'fog'->>'imageId', '') <> '')
  ),
  mapimg as (
    select case when coalesce(data->'fog'->>'on', '') = 'true' then data->'fog'->>'imageId' else data->>'imageId' end as img from maps
  ),
  -- Clean pictures of fogged maps (visible or not) are never sent.
  fogged as (
    select data->>'imageId' as img from live
    where table_name = 'maps' and coalesce(data->'fog'->>'on', '') = 'true' and data->>'imageId' is not null
  ),
  -- What the GM shows at the table, now and earlier (handouts), goes to joined players only, never to a public wiki link.
  shown as (
    select (select data->'showing'->>'assetId' from wrow where data->'showing'->>'kind' = 'image' and viewer is not null) as img
  ),
  handouts as (
    select h from wrow, jsonb_array_elements(case when jsonb_typeof(data->'handouts') = 'array' and viewer is not null then data->'handouts' else '[]'::jsonb end) h
  ),
  handimg as (
    select h->>'assetId' as img from handouts where h->>'kind' = 'image' and h->>'assetId' is not null
  ),
  ses as (
    select id, data from live
    where table_name = 'sessions' and data->>'visibility' = 'players' and data->>'campaignId' in (select id from camps)
  ),
  -- Pictures placed in the text ("![…](asset:<id>)"), counted only from what players actually receive.
  inline as (
    select (regexp_matches(t, 'asset:([0-9a-fA-F-]{36})', 'g'))[1] as img
    from (
      select public.player_text(data->>'body', names) as t from ents
      union all select public.player_text(data->>'playerBody', names) from ents
      union all select public.player_text(data->>'recap', names) from ses
    ) texts
  ),
  pins as (
    select p.id, p.data from live p join maps m on m.id = p.data->>'mapId'
    where p.table_name = 'pins' and p.data->>'visibility' = 'players' and public.fog_pin_revealed(m.data->'fog', p.data)
  ),
  assets as (
    select id, data from live a where a.table_name = 'assets' and (
      a.data->>'visibility' = 'players'
      or a.id in (select data->>'imageId' from ents where data->>'imageId' is not null)
      or a.id in (select img from mapimg where img is not null)
      or a.id = (select img from shown)
      or a.id in (select img from handimg)
      or a.id in (select img from inline)
    ) and (a.id not in (select img from fogged) or a.id = (select img from shown))
  )
  select jsonb_build_object(
    'worldId', wid,
    -- A public wiki link gets no safety tools (lines and veils are for the table), nothing shown and no handouts.
    'world', (select (data - 'gmNotes' - 'showing' - 'handouts' - case when viewer is null then 'safety' else '' end) || jsonb_build_object('showing',
        case
          when viewer is null or jsonb_typeof(data->'showing') is distinct from 'object' then 'null'::jsonb
          when data->'showing'->>'kind' = 'image' then data->'showing'
          when data->'showing'->>'kind' = 'page' and data->'showing'->>'entityId' in (select id from ents) then data->'showing'
          when data->'showing'->>'kind' = 'text' then data->'showing' || jsonb_build_object('text', public.player_text(data->'showing'->>'text', names))
          else 'null'::jsonb
        end,
        'handouts', coalesce((select jsonb_agg(case
            when h->>'kind' = 'text' then h || jsonb_build_object('text', public.player_text(h->>'text', names))
            else h end)
          from handouts
          where h->>'kind' = 'text'
            or (h->>'kind' = 'page' and h->>'entityId' in (select id from ents))
            or (h->>'kind' = 'image' and h->>'assetId' in (select id from assets))), '[]'::jsonb)) from wrow),
    -- Session dates are for the table, not for a public wiki link.
    'campaigns', coalesce((select jsonb_agg(case when viewer is null then data - 'schedule' - 'booked' else data end) from camps), '[]'::jsonb),
    'entities', coalesce((select jsonb_agg(
        -- Nicknames and GM tags are the GM's own; details ticked "GM only" are left out.
        (data - 'revealedTo' - 'aliases' - 'gmTags') || jsonb_build_object(
          'fields', coalesce((select jsonb_agg(f) from jsonb_array_elements(
              case when jsonb_typeof(data->'fields') = 'array' then data->'fields' else '[]'::jsonb end) f
            where coalesce(f->>'gm', '') <> 'true'), '[]'::jsonb),
          'gmNotes', '',
          -- Pages revealed only to this viewer arrive as ordinary revealed pages, flagged so the app can say so.
          'visibility', 'players',
          'secretForYou', data->>'visibility' <> 'players',
          'body', public.player_text(data->>'body', names),
          'playerBody', case when data ? 'playerBody' then to_jsonb(public.player_text(data->>'playerBody', names)) else 'null'::jsonb end,
          'parentId', case when data->>'parentId' in (select id from ents) then data->'parentId' else 'null'::jsonb end,
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end,
          -- Who carries an item: the party, or a character the viewer can see.
          'heldBy', case when data->>'heldBy' = 'party' or data->>'heldBy' in (select id from ents) then data->'heldBy' else 'null'::jsonb end,
          -- A character's status (dead, missing...) only when the GM ticked "Players know this".
          'status', case when coalesce(data->>'statusKnown', '') = 'true' then coalesce(data->'status', 'null'::jsonb) else 'null'::jsonb end,
          -- Links and clocks only when the GM ticked "Players know", and links only to pages the viewer can see.
          'relations', coalesce((select jsonb_agg(r) from jsonb_array_elements(
              case when jsonb_typeof(data->'relations') = 'array' then data->'relations' else '[]'::jsonb end) r
            where r->>'known' = 'true' and r->>'to' in (select id from ents)), '[]'::jsonb),
          'clocks', coalesce((select jsonb_agg(c) from jsonb_array_elements(
              case when jsonb_typeof(data->'clocks') = 'array' then data->'clocks' else '[]'::jsonb end) c
            where c->>'known' = 'true'), '[]'::jsonb)
        )) from ents), '[]'::jsonb),
    'maps', coalesce((select jsonb_agg(
        (data - 'drawing' - 'fog') || jsonb_build_object(
          'imageId', case when coalesce(data->'fog'->>'on', '') = 'true' then data->'fog'->'imageId' else data->'imageId' end,
          'locationId', case when data->>'locationId' in (select id from ents) then data->'locationId' else 'null'::jsonb end
        )) from maps), '[]'::jsonb),
    'pins', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'note', public.player_text(data->>'note', names),
          'entityId', case when data->>'entityId' in (select id from ents) then data->'entityId' else 'null'::jsonb end,
          'childMapId', case when data->>'childMapId' in (select id from maps) then data->'childMapId' else 'null'::jsonb end
        )) from pins), '[]'::jsonb),
    -- Sessions are rebuilt from a list of player-safe fields, so GM-only additions (notes, recordings,
    -- transcripts, recap drafts, the Lectern, prep) can never slip through.
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
          'id', to_jsonb(id),
          'worldId', data->'worldId',
          'campaignId', data->'campaignId',
          'number', data->'number',
          'title', data->'title',
          'date', data->'date',
          'worldDate', data->'worldDate',
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

-- ---------- group notes don't overwrite each other ----------

-- Saves a note. With "expected" (the note's updated_at when the player started typing), a group
-- note someone else changed since is not overwritten: their version comes back instead.
create or replace function public.save_player_note(wid uuid, eid text, shared boolean, body text, expected timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d jsonb;
  cur public.player_notes;
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
  if shared then
    select * into cur from public.player_notes n where n.world_id = wid and n.entity_id = eid and n.scope = 'group' for update;
    if found and cur.updated_by is distinct from me and cur.body <> '' and (expected is null or cur.updated_at > expected + interval '1 millisecond') then
      return jsonb_build_object('body', cur.body, 'updatedBy', cur.updated_by, 'updatedAt', cur.updated_at);
    end if;
  end if;
  insert into public.player_notes (world_id, entity_id, scope, body, updated_by)
  values (wid, eid, case when shared then 'group' else me::text end, left(coalesce(body, ''), 50000), me)
  on conflict (world_id, entity_id, scope) do update set body = excluded.body, updated_by = excluded.updated_by;
  return null;
end $$;
revoke execute on function public.save_player_note(uuid, text, boolean, text, timestamptz) from public, anon;
grant execute on function public.save_player_note(uuid, text, boolean, text, timestamptz) to authenticated;

-- ---------- the X-card is kept until the GM sees it ----------

create table if not exists public.xcard_taps (
  id bigint generated always as identity primary key,
  world_id uuid not null references public.cloud_worlds(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists xcard_taps_world on public.xcard_taps (world_id, at);
alter table public.xcard_taps enable row level security;
grant select on public.xcard_taps to authenticated;
drop policy if exists "gms see x-card taps" on public.xcard_taps;
create policy "gms see x-card taps" on public.xcard_taps for select to authenticated using (public.is_world_gm(world_id));

-- A player taps the X-card. No name is kept. Old taps are cleared after a day.
create or replace function public.tap_xcard(wid uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_world_member(wid) then
    raise exception 'Only players in this world can use its X-card.';
  end if;
  if (select count(*) from public.xcard_taps t where t.world_id = wid and t.at > now() - interval '1 minute') >= 5 then
    return;
  end if;
  delete from public.xcard_taps t where t.world_id = wid and t.at < now() - interval '1 day';
  insert into public.xcard_taps (world_id) values (wid);
end $$;
revoke execute on function public.tap_xcard(uuid) from public, anon;
grant execute on function public.tap_xcard(uuid) to authenticated;

-- ---------- private live channels ----------

-- Who may listen to (or, with sending, post on) a live channel. Topics: "safety:<world>" (X-card),
-- "members:<world>" (refresh signal for players) and "share:<token>" (refresh signal for a wiki link).
create or replace function public.channel_allowed(topic text, sending boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  kind text := split_part(topic, ':', 1);
  rest text := substr(topic, length(split_part(topic, ':', 1)) + 2);
  wid uuid;
begin
  if kind = 'share' then
    select id into wid from public.cloud_worlds where share_token = rest and length(rest) >= 20;
    return wid is not null and (not sending or public.is_world_gm(wid));
  end if;
  if rest !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  wid := rest::uuid;
  if kind in ('safety', 'members') then
    return public.is_world_member(wid) or public.is_world_gm(wid);
  end if;
  return false;
end $$;
revoke execute on function public.channel_allowed(text, boolean) from public;
grant execute on function public.channel_allowed(text, boolean) to anon, authenticated;

drop policy if exists "world channels: listen" on realtime.messages;
create policy "world channels: listen" on realtime.messages for select to anon, authenticated
  using (public.channel_allowed(realtime.topic(), false));
drop policy if exists "world channels: send" on realtime.messages;
create policy "world channels: send" on realtime.messages for insert to anon, authenticated
  with check (public.channel_allowed(realtime.topic(), true));

-- ---------- keep-alive ----------

-- Called once a week by a GitHub Action so the free project never pauses for lack of use.
create or replace function public.ping() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cloud_worlds limit 1) or true
$$;
revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
