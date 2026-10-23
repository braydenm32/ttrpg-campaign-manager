-- Fog of war, "show to players", relationships, clocks, the in-world calendar on sessions, and
-- players editing their own character.
--  - Fog of war: on a fogged map, players get the GM's fogged copy of the picture (fog.imageId)
--    instead of the clean one, the clean picture is never listed for them, and pins under the fog
--    are held back. fog_point_revealed mirrors pointRevealed in src/fog.ts.
--  - World.showing: what the GM is showing every player. A page only when the viewer can see it;
--    text has its secret passages removed; a picture is passed on because the GM chose to show it.
--  - Relationships and clocks: only the ones marked "Players know" (known), and only links to pages
--    the viewer can see.
--  - playerBody (a character in the player's own words) passes through player_text like the body.
--  - Sessions: worldDate (the in-world date) joins the allow-list.
--  - edit_my_character: a player updates the summary, details and their own write-up of the
--    character they play. Nothing else on the page can be changed this way.

create or replace function public.fog_point_revealed(shapes jsonb, y double precision, x double precision) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  s jsonb;
  pts jsonb;
  n int;
  i int;
  j int;
  inside boolean;
  result boolean := false;
  yi double precision;
  xi double precision;
  yj double precision;
  xj double precision;
begin
  if shapes is null or jsonb_typeof(shapes) <> 'array' then
    return false;
  end if;
  -- The last shape that contains the point decides: uncovered or covered again.
  for s in select value from jsonb_array_elements(shapes) loop
    pts := s->'points';
    if pts is null or jsonb_typeof(pts) <> 'array' then
      continue;
    end if;
    n := jsonb_array_length(pts);
    inside := false;
    j := n - 1;
    for i in 0..n - 1 loop
      yi := (pts->i->>0)::double precision;
      xi := (pts->i->>1)::double precision;
      yj := (pts->j->>0)::double precision;
      xj := (pts->j->>1)::double precision;
      if ((yi > y) <> (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi) then
        inside := not inside;
      end if;
      j := i;
    end loop;
    if inside then
      result := (s->>'mode') = 'reveal';
    end if;
  end loop;
  return result;
end $$;

-- A pin shows on a fogged map when its spot is uncovered (a region: any corner uncovered).
create or replace function public.fog_pin_revealed(fog jsonb, pin jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(fog->>'on', '') <> 'true'
    or (jsonb_typeof(pin->'position') = 'array'
        and public.fog_point_revealed(fog->'shapes', (pin->'position'->>0)::double precision, (pin->'position'->>1)::double precision))
    or (jsonb_typeof(pin->'position') is distinct from 'array' and jsonb_typeof(pin->'points') = 'array'
        and exists (select 1 from jsonb_array_elements(pin->'points') p
                    where public.fog_point_revealed(fog->'shapes', (p->>0)::double precision, (p->>1)::double precision)))
$$;

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
  shown as (
    select (select data->'showing'->>'assetId' from wrow where data->'showing'->>'kind' = 'image') as img
  ),
  ses as (select id, data from live where table_name = 'sessions' and data->>'visibility' = 'players'),
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
    ) and (a.id not in (select img from fogged) or a.id = (select img from shown))
  )
  select jsonb_build_object(
    'worldId', wid,
    'world', (select (data - 'gmNotes' - 'showing') || jsonb_build_object('showing',
        case
          when jsonb_typeof(data->'showing') is distinct from 'object' then 'null'::jsonb
          when data->'showing'->>'kind' = 'image' then data->'showing'
          when data->'showing'->>'kind' = 'page' and data->'showing'->>'entityId' in (select id from ents) then data->'showing'
          when data->'showing'->>'kind' = 'text' then data->'showing' || jsonb_build_object('text', public.player_text(data->'showing'->>'text', names))
          else 'null'::jsonb
        end) from wrow),
    'campaigns', coalesce((select jsonb_agg(data) from live where table_name = 'campaigns'), '[]'::jsonb),
    'entities', coalesce((select jsonb_agg(
        (data - 'revealedTo') || jsonb_build_object(
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

create or replace function public.edit_my_character(wid uuid, eid text, summary text, fields jsonb, player_body text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean jsonb;
begin
  if not exists (select 1 from public.character_claims c where c.world_id = wid and c.entity_id = eid and c.user_id = me)
     or not public.claimable_character(wid, eid, me) then
    raise exception 'You can only edit a character you play.';
  end if;
  if jsonb_typeof(coalesce(fields, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(fields, '[]'::jsonb)) > 60 then
    raise exception 'Too many details (60 at most).';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('key', left(coalesce(f->>'key', ''), 200), 'value', left(coalesce(f->>'value', ''), 2000))), '[]'::jsonb)
    into clean
    from jsonb_array_elements(coalesce(fields, '[]'::jsonb)) f
    where jsonb_typeof(f) = 'object' and (coalesce(f->>'key', '') <> '' or coalesce(f->>'value', '') <> '');
  update public.records r
    set data = r.data || jsonb_build_object(
          'summary', left(coalesce(summary, ''), 500),
          'fields', clean,
          'playerBody', left(coalesce(player_body, ''), 20000),
          'updatedAt', (extract(epoch from now()) * 1000)::bigint),
        updated_by = me
    where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted;
end $$;
revoke execute on function public.edit_my_character(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.edit_my_character(uuid, text, text, jsonb, text) to authenticated;
