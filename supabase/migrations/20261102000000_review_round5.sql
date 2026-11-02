-- Review round 5: privacy tidy-ups on the server.
--  - Old copies of replaced functions are removed. Postgres keeps a function with a different list of
--    arguments as a separate function, so the first save_player_note (4 arguments, no "only the GM can
--    write GM:" guard and no "someone else changed it" check) was still callable by any signed-in user.
--    The app only calls the 5-argument one (src/cloud/players.ts, savePlayerNote, always sends "expected").
--  - player_view (as in 20261030000000_new_features.sql apart from these three changes):
--      * a public wiki link gets a session's real-world date only once that session has been played;
--      * pictures named in a player's own write-up (playerBody) no longer decide which pictures go out;
--      * the note on a relationship players know goes through player_text like every other text.
--  - A "gm:<world>" live room: players may post there, only GMs may listen (secret roll results).
--  - The two downtime policies read auth.uid() once per query, and the internal text helpers can no
--    longer be called directly by anon (the functions that use them are security definer).
-- Safe to run more than once; the app works both before and after it.

-- ---------- old copies of replaced functions ----------

drop function if exists public.save_player_note(uuid, text, boolean, text);
drop function if exists public.player_view(uuid);
drop function if exists public.claimable_character(uuid, text);

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
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid, uuid) from public, anon, authenticated;

-- ---------- a room only GMs hear ----------

-- Who may listen to (or, with sending, post on) a live channel. Topics: "safety:<world>" (X-card),
-- "members:<world>" (refresh signal and the players' side of the live table), "table:<world>" (the
-- GM's side of the live table: only a GM sends there), "gm:<world>" (players' results for called
-- rolls, secret ones included, and their signals: anyone in the world may post, only a GM may listen)
-- and "share:<token>" (refresh signal for a wiki link). As in 20261029010000_review_fixes.sql plus "gm".
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
  if kind = 'gm' then
    return public.is_world_gm(wid) or (sending and public.is_world_member(wid));
  end if;
  return false;
end $$;
revoke execute on function public.channel_allowed(text, boolean) from public;
grant execute on function public.channel_allowed(text, boolean) to anon, authenticated;

-- ---------- downtime policies: auth.uid() once per query ----------

drop policy if exists "players read own downtime" on public.downtime_actions;
create policy "players read own downtime" on public.downtime_actions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "players take back downtime" on public.downtime_actions;
create policy "players take back downtime" on public.downtime_actions for delete to authenticated using (user_id = (select auth.uid()) and answer is null);

-- ---------- internal helpers ----------

-- Used only inside player_view, member_world, shared_world, save_player_note and the like. Those are
-- security definer (they run as their owner), so they keep using these; nobody calls them directly.
revoke execute on function public.player_text(text, text[]) from public, anon;
revoke execute on function public.for_names(text) from public, anon;
revoke execute on function public.entity_visible_to(jsonb, uuid) from public, anon;
revoke execute on function public.fog_point_revealed(jsonb, double precision, double precision) from public, anon;
revoke execute on function public.fog_pin_revealed(jsonb, jsonb) from public, anon;
revoke execute on function public.strip_gm_blocks(text) from public, anon;
