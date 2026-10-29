-- Fixes from a review of what players can see and send:
--  - Map pictures that are never sent (a fogged map's clean picture, a map's GM copy with its secrets)
--    are no longer let through when the GM shows one at the table or as a handout.
--  - Pictures pasted into a revealed map pin's note now reach players.
--  - A random table's lines reach players without "#" notes or secret passages.
--  - A new live channel, "table:<world>", where only a GM can send, so a player can't pretend to be
--    the GM on the live table (turn order, "playing now", GM rolls).
--  - In group notes, a line that looks like a GM reply ("- **GM:** …") stays one only if the GM wrote it.
-- player_view is as in 20261028010000_map_secrets.sql apart from those changes. Safe to run more than once.

-- ---------- what players receive ----------

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
  -- The picture players get: the fogged one, or else a drawn map's players' copy (without its secrets), or else the map.
  mapimg as (
    select case when coalesce(data->'fog'->>'on', '') = 'true' then data->'fog'->>'imageId'
      else coalesce(nullif(data->>'playerImageId', ''), data->>'imageId') end as img from maps
  ),
  -- Pictures that are never sent (visible maps or not): the clean picture of a fogged map, the GM's copy
  -- of a map with secrets on it, and the players' copy of a fogged one (it has no fog on it).
  fogged as (
    select data->>'imageId' as img from live
    where table_name = 'maps' and data->>'imageId' is not null
      and (coalesce(data->'fog'->>'on', '') = 'true' or coalesce(data->>'playerImageId', '') <> '')
    union all
    select data->>'playerImageId' from live
    where table_name = 'maps' and coalesce(data->'fog'->>'on', '') = 'true' and coalesce(data->>'playerImageId', '') <> ''
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
  pins as (
    select p.id, p.data from live p join maps m on m.id = p.data->>'mapId'
    where p.table_name = 'pins' and p.data->>'visibility' = 'players' and public.fog_pin_revealed(m.data->'fog', p.data)
  ),
  -- Pictures placed in the text ("![…](asset:<id>)"), counted only from what players actually receive,
  -- including a map pin's note.
  inline as (
    select (regexp_matches(t, 'asset:([0-9a-fA-F-]{36})', 'g'))[1] as img
    from (
      select public.player_text(data->>'body', names) as t from ents
      union all select public.player_text(data->>'playerBody', names) from ents
      union all select public.player_text(data->>'recap', names) from ses
      union all select public.player_text(data->>'note', names) from pins
    ) texts
  ),
  assets as (
    select id, data from live a where a.table_name = 'assets' and (
      a.data->>'visibility' = 'players'
      or a.id = (select data->>'coverId' from wrow)
      or a.id in (select data->>'imageId' from ents where data->>'imageId' is not null)
      or a.id in (select img from mapimg where img is not null)
      or a.id = (select img from shown)
      or a.id in (select img from handimg)
      or a.id in (select img from inline)
    ) and a.id not in (select img from fogged)
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
        -- A random table's lines: no "#" notes, no secret passages, and no line left empty by them.
        ) || case when jsonb_typeof(data->'entries') = 'array' then jsonb_build_object('entries', coalesce((
            select jsonb_agg(t order by n) from (
              select public.player_text(x, names) as t, n from jsonb_array_elements_text(data->'entries') with ordinality as l(x, n)
              where ltrim(x, E' \t') not like '#%'
            ) kept where btrim(t) <> ''), '[]'::jsonb))
          else '{}'::jsonb end
        ) from ents), '[]'::jsonb),
    'maps', coalesce((select jsonb_agg(
        (data - 'drawing' - 'fog' - 'playerImageId') || jsonb_build_object(
          'imageId', case when coalesce(data->'fog'->>'on', '') = 'true' then data->'fog'->'imageId'
            when coalesce(data->>'playerImageId', '') <> '' then data->'playerImageId' else data->'imageId' end,
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

-- ---------- private live channels ----------

-- Who may listen to (or, with sending, post on) a live channel. Topics: "safety:<world>" (X-card),
-- "members:<world>" (refresh signal and the players' side of the live table), "table:<world>" (the
-- GM's side of the live table: only a GM sends there) and "share:<token>" (refresh signal for a wiki link).
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
  if kind = 'table' then
    return public.is_world_gm(wid) or (not sending and public.is_world_member(wid));
  end if;
  return false;
end $$;
revoke execute on function public.channel_allowed(text, boolean) from public;
grant execute on function public.channel_allowed(text, boolean) to anon, authenticated;

-- ---------- GM replies in group notes can't be made up ----------

-- As in 20261026000000_round_two.sql, except that in a group note a line that looks like a GM reply
-- ("- **GM:** …", which the app sets apart) is kept as one only if it was already there: one a
-- player adds or changes is relabelled "“GM”", so it reads as an ordinary line.
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
    select string_agg(
        case when l ~ '^\s*[-*]\s+\*\*GM:\*\*' and not (l = any(string_to_array(replace(coalesce(cur.body, ''), E'\r', ''), E'\n')))
          then regexp_replace(l, '\*\*GM:\*\*', '**“GM”:**')
          else l end,
        E'\n' order by n)
      into body
      from unnest(string_to_array(replace(coalesce(body, ''), E'\r', ''), E'\n')) with ordinality as x(l, n);
  end if;
  insert into public.player_notes (world_id, entity_id, scope, body, updated_by)
  values (wid, eid, case when shared then 'group' else me::text end, left(coalesce(body, ''), 50000), me)
  on conflict (world_id, entity_id, scope) do update set body = excluded.body, updated_by = excluded.updated_by;
  return null;
end $$;
revoke execute on function public.save_player_note(uuid, text, boolean, text, timestamptz) from public, anon;
grant execute on function public.save_player_note(uuid, text, boolean, text, timestamptz) to authenticated;
