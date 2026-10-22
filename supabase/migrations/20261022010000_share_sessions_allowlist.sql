-- Share links: send sessions as an allow-list of player-safe fields, and strip :::gm passages from recaps.
create or replace function public.shared_world(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w public.cloud_worlds;
  result jsonb;
begin
  if token is null or length(token) < 20 then
    return null;
  end if;
  select * into w from public.cloud_worlds where share_token = token;
  if not found then
    return null;
  end if;

  with live as (
    select table_name, id, data from public.records where world_id = w.id and not deleted and data is not null
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
    'worldId', w.id,
    'world', (select data - 'gmNotes' from live where table_name = 'worlds' and id = w.id::text),
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
    -- the Lectern) can never slip through. The recap also loses any :::gm passages.
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
    'updatedAt', (select max(updated_at) from public.records where world_id = w.id)
  ) into result;
  return result;
end $$;
revoke execute on function public.shared_world(text) from public;
grant execute on function public.shared_world(text) to anon, authenticated;
