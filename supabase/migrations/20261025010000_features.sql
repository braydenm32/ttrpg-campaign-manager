-- New features from the October 2026 review.
--  - Hidden campaigns: a campaign with visibility 'gm' (and its sessions) never reaches players.
--  - "GM only" details: a page's details ticked gm stay off the player's copy, and a player editing
--    their own character keeps them (they can't see or remove them).
--  - Page nicknames (aliases) and GM tags are GM-only.
--  - Pictures in page text ("![…](asset:<id>)") reach players when the text they get uses them.
-- Builds on 20261025000000_audit_fixes.sql.

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
  shown as (
    select (select data->'showing'->>'assetId' from wrow where data->'showing'->>'kind' = 'image') as img
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
      or a.id in (select img from inline)
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
    'campaigns', coalesce((select jsonb_agg(data) from camps), '[]'::jsonb),
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

create or replace function public.edit_my_character(wid uuid, eid text, summary text, fields jsonb, player_body text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean jsonb;
begin
  if not exists (select 1 from public.character_claims c where c.world_id = wid and c.entity_id = eid and c.user_id = me and c.approved)
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
          -- The player's details, plus any the GM keeps to themselves (which the player never sees).
          'fields', clean || coalesce((select jsonb_agg(f) from jsonb_array_elements(
              case when jsonb_typeof(r.data->'fields') = 'array' then r.data->'fields' else '[]'::jsonb end) f
            where f->>'gm' = 'true'), '[]'::jsonb),
          'playerBody', left(coalesce(player_body, ''), 20000),
          'updatedAt', (extract(epoch from now()) * 1000)::bigint),
        updated_by = me
    where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted;
end $$;
revoke execute on function public.edit_my_character(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.edit_my_character(uuid, text, text, jsonb, text) to authenticated;
