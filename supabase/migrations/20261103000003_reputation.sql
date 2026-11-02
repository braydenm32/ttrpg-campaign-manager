-- The party's reputation: how far their name has spread, which way the talk leans, how particular
-- places see them, and every change with its reason (src/reputation.tsx). Each player character has a
-- smaller one of their own.
--  - records: a new kind of row, "reputation" (one per world for the party, one per character). Until
--    this runs the cloud refuses those rows; the app keeps them on the GM's device and sends them on the
--    first sync after (src/cloud/sync.ts, sendNewer), and the rest of the world syncs as before.
--  - player_view: as in 20261102000000_review_round5.sql, plus ONE new key, "reputation" (marked >>> <<<
--    below). Only the reach, the lean, the level names and what the GM ticked for players go out; GM-only
--    place notes and GM-only reasons never do. Nothing else in player_view changes.
-- Safe to run more than once; the app works both before and after it.

-- ---------- a new kind of synced row ----------

alter table public.records drop constraint if exists records_table_name_check;
alter table public.records add constraint records_table_name_check
  check (table_name in ('worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds', 'reputation'));

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
  -- including a map pin's note. Only text the GM writes counts: a player's own write-up (playerBody)
  -- could otherwise name any picture whose id they know and have it sent. A picture there still goes
  -- out when the picture itself is marked for players (the first test in "assets" below).
  inline as (
    select (regexp_matches(t, 'asset:([0-9a-fA-F-]{36})', 'g'))[1] as img
    from (
      select public.player_text(data->>'body', names) as t from ents
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
    -- The GM screen (pinned pages, saved rolls) is the GM's own.
    'world', (select (data - 'gmNotes' - 'gmScreen' - 'showing' - 'handouts' - case when viewer is null then 'safety' else '' end) || jsonb_build_object('showing',
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
    -- The story so far without secret passages.
    'campaigns', coalesce((select jsonb_agg((case when viewer is null then data - 'schedule' - 'booked' else data end)
        || case when data ? 'storySoFar' then jsonb_build_object('storySoFar', public.player_text(data->>'storySoFar', names)) else '{}'::jsonb end) from camps), '[]'::jsonb),
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
          -- A link's note loses its secret passages, like every other text.
          'relations', coalesce((select jsonb_agg(case when r ? 'note' then r || jsonb_build_object('note', public.player_text(r->>'note', names)) else r end) from jsonb_array_elements(
              case when jsonb_typeof(data->'relations') = 'array' then data->'relations' else '[]'::jsonb end) r
            where r->>'known' = 'true' and r->>'to' in (select id from ents)), '[]'::jsonb),
          'clocks', coalesce((select jsonb_agg(c) from jsonb_array_elements(
              case when jsonb_typeof(data->'clocks') = 'array' then data->'clocks' else '[]'::jsonb end) c
            where c->>'known' = 'true'), '[]'::jsonb),
          -- A quest's steps and rewards only once the GM shows them, and a reward's item only if the viewer can see it.
          'objectives', coalesce((select jsonb_agg(o || jsonb_build_object('text', public.player_text(o->>'text', names)))
            from jsonb_array_elements(case when jsonb_typeof(data->'objectives') = 'array' then data->'objectives' else '[]'::jsonb end) o
            where o->>'known' = 'true'), '[]'::jsonb),
          'rewards', coalesce((select jsonb_agg(w || jsonb_build_object(
                'text', public.player_text(w->>'text', names),
                'itemId', case when w->>'itemId' in (select id from ents) then w->'itemId' else 'null'::jsonb end))
            from jsonb_array_elements(case when jsonb_typeof(data->'rewards') = 'array' then data->'rewards' else '[]'::jsonb end) w
            where w->>'known' = 'true'), '[]'::jsonb)
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
          -- The real-world date: always for the table, but for a public wiki link (no viewer) only once the
          -- session has been played, so a stranger never learns when the group meets next. "Played" here is
          -- what the app calls played (src/sessions.ts, sessionStage): marked played, or it has a recap, or
          -- its date is before today (the server's today, in UTC; a day early or late is harmless).
          'date', case
            when viewer is not null then data->'date'
            when coalesce(data->>'playedAt', '') <> ''
              or btrim(coalesce(data->>'recap', '')) <> ''
              or (coalesce(data->>'date', '') ~ '^\d{4}-\d{2}-\d{2}' and data->>'date' < to_char(current_date, 'YYYY-MM-DD'))
              then data->'date'
            else to_jsonb(''::text) end,
          'worldDate', data->'worldDate',
          'visibility', data->'visibility',
          'createdAt', data->'createdAt',
          'recap', public.player_text(data->>'recap', names),
          'highlights', coalesce((select jsonb_agg(jsonb_build_object(
                'id', h->'id', 'kind', h->'kind', 'who', h->'who', 'text', public.player_text(h->>'text', names)))
            from jsonb_array_elements(case when jsonb_typeof(data->'highlights') = 'array' then data->'highlights' else '[]'::jsonb end) h), '[]'::jsonb),
          'notes', '',
          'recordings', '[]'::jsonb,
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    -- >>> 20261103000003_reputation: the one addition to player_view in this file (keep it when combining).
    -- How far the party's name (and each character's) has spread. Rebuilt from a list of safe fields, like
    -- sessions: the reach, the lean and the ladder's level names, plus only the place notes and the reasons
    -- the GM ticked "Players can see" (known), each through player_text. A character's own reputation goes
    -- only to someone who can see that character's page; a note's place page and a change's session only
    -- when the viewer can see them. Public wiki readers get the same (Brayden's 11b keeps loot, leads and
    -- clocks from them, not this). Before this file the key is missing and the app shows nothing.
    'reputation', coalesce((select jsonb_agg(jsonb_build_object(
          'id', to_jsonb(r.id),
          'worldId', r.data->'worldId',
          'of', r.data->'of',
          'reach', coalesce(r.data->'reach', '0'::jsonb),
          'lean', coalesce(r.data->'lean', '0'::jsonb),
          'levels', case when jsonb_typeof(r.data->'levels') = 'array' then r.data->'levels' else 'null'::jsonb end,
          'notes', coalesce((select jsonb_agg(jsonb_build_object(
                'id', n->'id',
                'known', true,
                'place', public.player_text(n->>'place', names),
                'text', public.player_text(n->>'text', names),
                'entityId', case when n->>'entityId' in (select id from ents) then n->'entityId' else 'null'::jsonb end) order by k)
            from jsonb_array_elements(case when jsonb_typeof(r.data->'notes') = 'array' then r.data->'notes' else '[]'::jsonb end) with ordinality as nl(n, k)
            where n->>'known' = 'true'), '[]'::jsonb),
          'history', coalesce((select jsonb_agg(jsonb_build_object(
                'id', h->'id',
                'at', h->'at',
                'known', true,
                'fromReach', h->'fromReach',
                'reach', h->'reach',
                'fromLean', h->'fromLean',
                'lean', h->'lean',
                'reason', public.player_text(h->>'reason', names),
                'sessionId', case when h->>'sessionId' in (select id from ses) then h->'sessionId' else 'null'::jsonb end) order by k)
            from jsonb_array_elements(case when jsonb_typeof(r.data->'history') = 'array' then r.data->'history' else '[]'::jsonb end) with ordinality as hl(h, k)
            where h->>'known' = 'true'), '[]'::jsonb),
          'createdAt', r.data->'createdAt',
          'updatedAt', r.data->'updatedAt'))
        from live r
        where r.table_name = 'reputation' and (r.data->>'of' = 'party' or r.data->>'of' in (select id from ents))), '[]'::jsonb),
    -- <<< 20261103000003_reputation
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid, uuid) from public, anon, authenticated;
