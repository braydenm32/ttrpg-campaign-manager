-- Fixes from the November 2026 security review. How to apply it, check it and undo it:
-- supabase/APPLY-2026-11-07.md. Tested by supabase/tests (see its README).
-- Safe to run more than once, and it removes nothing the app uses. The app works before and after it.
--
--  - player_view (what joined players and public wiki links receive), as in
--    20261103000003_reputation.sql except for the parts marked >>> 20261107000000 <<< below:
--     * VIS-1: a link with its own label to a page the viewer doesn't get ("[[Duke Orlov|the hooded
--       stranger]]") arrives as just its label, so the page's real name never reaches them. The same
--       goes for a link to a page's GM-only nickname. Links to pages they get, and links without a
--       label (their words are on the screen anyway), arrive as they are.
--     * VIS-3: timeline ages go out only when the viewer gets at least one event in them, which is
--       what the app already shows players.
--     * VIS-9: files arrive with a plain name ("Picture", "Sound", "Video" or "File") and no tags, so
--       the GM's own file names never reach players, and with the id of the row they're stored in.
--     * SHOW-1: a picture the GM is showing that the viewer doesn't get (a fogged map's clean copy, or
--       a map's GM copy) arrives as nothing shown, rather than as that picture's id.
--     * VIS-6: a random-table line counts as a "#" note whatever kind of space comes before the #
--       (a no-break space, say), as in the app.
--  - player_text (secret passages):
--     * VIS-4: "\r\n", "\r" and "\n" all end a line, rather than "\r" being deleted (which could turn
--       a line the app treats as text into a ":::" that ends a GM block early). The app's side of this
--       is in src/Markdown.tsx (splitSecrets); see APPLY-2026-11-07.md for the order to ship them in.
--     * VIS-5: any line starting ":::foryou" is hidden, with or without a space after it, so nobody can
--       forge an "only you know" passage in text that other players read.
--  - Names (NAME-1): no control characters, and none of the invisible or right-to-left ones that make
--    one name look like another. Nobody can take a name someone else in the world already has (big or
--    small letters don't count).
--  - Co-GM links work once (the owner's choice, 4a): joining with one turns it off, and the GM makes a
--    new one for the next co-GM. Player invite links keep working until the GM makes a new one.
--  - records (FILE-2): a synced row's id and world must be the ones written inside it.
--  - world_members (MEM-1): an owner can still see and remove people, but can't add anyone (or swap one
--    person for another). People join only with a link, through join_world.
--  - Table rights (PRIV-10): signed-in and signed-out callers lose TRUNCATE, REFERENCES and TRIGGER on
--    the app's tables (and MAINTAIN, which Postgres 17 adds), for these tables and for new ones.
--  - Storage (FILE-7): one file in the "assets" bucket can be at most 50 MB (52428800 bytes).
-- Left as it is: set_player_notes(uuid, text, text) (OLD-1), because the app still uses it for a
-- player's notes on their character (savePlayerNotes in src/cloud/players.ts).

-- ---------- helpers ----------

-- Trims what the app's String.trim() trims: spaces, tabs, line breaks, no-break and other Unicode
-- spaces, and the byte-order mark.
create or replace function public.app_trim(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(t,
    '^[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$',
    '', 'g')
$$;

-- "[[Page]]" and "[[Page|label]]" links in text a viewer gets (read the way src/Markdown.tsx reads
-- them). A labelled link stays only when "pages" (the names of the pages the viewer gets, trimmed and
-- in small letters) has its page; otherwise just the label is left. Links without a label stay.
create or replace function public.player_links(t text, pages text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  parts text[];
  m text[];
  result text;
  i integer := 1;
begin
  if t is null or strpos(t, '[[') = 0 then
    return t;
  end if;
  -- The text between the links, then each link in turn (both find the same links, in order).
  parts := regexp_split_to_array(t, '\[\[[^]|]+(?:\|[^]]+)?\]\]');
  result := parts[1];
  for m in select regexp_matches(t, '\[\[([^]|]+)(\|([^]]+))?\]\]', 'g') loop
    i := i + 1;
    if m[3] is null or lower(public.app_trim(m[1])) = any(coalesce(pages, '{}'::text[])) then
      result := result || '[[' || m[1] || coalesce(m[2], '') || ']]';
    else
      result := result || m[3];
    end if;
    result := result || coalesce(parts[i], '');
  end loop;
  return result;
end $$;

-- How names are compared: "Sam", "SAM" and "Sam " (or a "Sam" with a hidden joiner, variation
-- selector or grapheme joiner in it) are one name. Keep in step with foldName in src/cloud/players.ts.
create or replace function public.member_name_key(name text) returns text
language sql immutable set search_path = '' as $$
  select btrim(lower(regexp_replace(regexp_replace(normalize(coalesce(name, ''), nfkc),
    '[\u034f\u180b-\u180d\u180f\u200c\u200d\ufe00-\ufe0f]|[\U000e0000-\U000e007f\U000e0100-\U000e01ef]', '', 'g'),
    '[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', 'g')))
$$;

-- Only player_view uses the first two. member_name_ok, which callers have always been able to use, uses
-- the third, so they keep that.
revoke execute on function public.app_trim(text), public.player_links(text, text[]) from public, anon, authenticated;
revoke execute on function public.member_name_key(text) from public;
grant execute on function public.member_name_key(text) to anon, authenticated;

-- ---------- secret passages ----------

-- As in 20261025000000_audit_fixes.sql, except for the two lines marked >>> <<<.
-- Keep player_text in step with splitSecrets in src/Markdown.tsx.
create or replace function public.player_text(t text, names text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  line text;
  result text[] := '{}';
  -- One entry per open passage, innermost last: 'skip' (hidden from this viewer) or 'keep'.
  stack text[] := '{}';
  skipping boolean;
  wanted text[] := coalesce((select array_agg(lower(trim(n))) from unnest(names) n), '{}');
  op text[];
  kw text;
  rest text;
  one text[];
  popped text;
begin
  if t is null then
    return '';
  end if;
  -- >>> 20261107000000 (VIS-4): "\r\n", "\r" and "\n" each end a line.
  foreach line in array string_to_array(regexp_replace(t, E'\r\n?', E'\n', 'g'), E'\n') loop
    skipping := 'skip' = any(stack);
    -- >>> 20261107000000 (VIS-5): ":::foryou" opens a hidden passage even with no space after it.
    op := regexp_match(line, '^[ \t]*:::[ \t]*(foryou|(?:gm|for)(?![a-z0-9]))(.*)$', 'i');
    if op is not null then
      kw := lower(op[1]);
      rest := op[2];
      if kw = 'for' then
        one := regexp_match(rest, '^[ \t]+(.+?):::(.*):::[ \t]*$');
      else
        one := regexp_match(rest, '^[: \t]*([^: \t].*?)[ \t]*:::[ \t]*$');
      end if;
      if one is not null then
        -- A one-line passage: only a ":::for" naming this viewer's character shows.
        if not skipping and kw = 'for' and public.for_names(one[1]) && wanted then
          if cardinality(stack) = 0 then
            result := result || ':::foryou'::text || trim(one[2]) || ':::'::text;
          else
            result := result || trim(one[2]);
          end if;
        end if;
      elsif skipping or kw <> 'for' then
        stack := stack || 'skip'::text;
      elsif public.for_names(regexp_replace(rest, '^[ \t:]*', '')) && wanted then
        -- With no names yet it's a secret for nobody, never for everyone.
        if cardinality(stack) = 0 then
          result := result || ':::foryou'::text;
        end if;
        stack := stack || 'keep'::text;
      else
        stack := stack || 'skip'::text;
      end if;
    elsif cardinality(stack) > 0 and line ~ '^[ \t]*:::[ \t]*$' then
      popped := stack[cardinality(stack)];
      stack := stack[1:cardinality(stack) - 1];
      if cardinality(stack) = 0 and popped = 'keep' then
        result := result || ':::'::text;
      end if;
    elsif not skipping then
      result := result || line;
    end if;
  end loop;
  -- A passage for this viewer that was never closed still ends cleanly.
  if cardinality(stack) > 0 and stack[1] = 'keep' then
    result := result || ':::'::text;
  end if;
  return array_to_string(result, E'\n');
end $$;

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
  -- >>> 20261107000000 (VIS-1): the names of the pages this viewer gets, as links are matched.
  pagenames as (
    select coalesce(array_agg(lower(public.app_trim(data->>'name'))), '{}'::text[]) as page_names from ents
  ),
  -- <<< 20261107000000
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
  -- A handout with a "reveal on" date stays back until then.
  handouts as (
    select h from wrow, jsonb_array_elements(case when jsonb_typeof(data->'handouts') = 'array' and viewer is not null then data->'handouts' else '[]'::jsonb end) h
    where not (h ? 'revealAt') or public.reveal_due(h)
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
  -- >>> 20261107000000 (VIS-1): every text players read goes through player_links(…, (select page_names from pagenames)).
  select jsonb_build_object(
    'worldId', wid,
    -- A public wiki link gets no safety tools (lines and veils are for the table), nothing shown and no handouts.
    -- The GM screen (pinned pages, saved rolls) is the GM's own.
    'world', (select (data - 'gmNotes' - 'gmScreen' - 'showing' - 'handouts' - 'ages' - case when viewer is null then 'safety' else '' end)
        -- >>> 20261107000000 (VIS-3): only the ages that hold an event this viewer gets, as the timeline shows them.
        || case when data ? 'ages' then jsonb_build_object('ages', coalesce((
            select jsonb_agg(a order by k)
            from jsonb_array_elements(case when jsonb_typeof(data->'ages') = 'array' then data->'ages' else '[]'::jsonb end) with ordinality as al(a, k)
            where exists (select 1 from ents e where e.data->>'type' = 'event' and coalesce(e.data->>'eventEra', '') <> 'campaign' and e.data->>'eventAge' = a->>'id')
          ), '[]'::jsonb)) else '{}'::jsonb end
        -- >>> 20261107000000 (VIS-1): the world's description.
        || case when jsonb_typeof(data->'description') = 'string'
            then jsonb_build_object('description', public.player_links(data->>'description', (select page_names from pagenames))) else '{}'::jsonb end
        || jsonb_build_object('showing',
        case
          when viewer is null or jsonb_typeof(data->'showing') is distinct from 'object' then 'null'::jsonb
          -- >>> 20261107000000 (SHOW-1): a picture only when the viewer gets that picture.
          when data->'showing'->>'kind' = 'image' then
            case when data->'showing'->>'assetId' in (select id from assets) then data->'showing' else 'null'::jsonb end
          when data->'showing'->>'kind' = 'page' and data->'showing'->>'entityId' in (select id from ents) then data->'showing'
          when data->'showing'->>'kind' = 'text' then data->'showing' || jsonb_build_object('text',
            public.player_links(public.player_text(data->'showing'->>'text', names), (select page_names from pagenames)))
          else 'null'::jsonb
        end,
        'handouts', coalesce((select jsonb_agg(case
            when h->>'kind' = 'text' then h || jsonb_build_object('text', public.player_links(public.player_text(h->>'text', names), (select page_names from pagenames)))
            else h end)
          from handouts
          where h->>'kind' = 'text'
            or (h->>'kind' = 'page' and h->>'entityId' in (select id from ents))
            or (h->>'kind' = 'image' and h->>'assetId' in (select id from assets))), '[]'::jsonb)) from wrow),
    -- Session dates are for the table, not for a public wiki link.
    -- The story so far without secret passages.
    'campaigns', coalesce((select jsonb_agg((case when viewer is null then data - 'schedule' - 'booked' else data end)
        || case when data ? 'storySoFar' then jsonb_build_object('storySoFar',
            public.player_links(public.player_text(data->>'storySoFar', names), (select page_names from pagenames))) else '{}'::jsonb end) from camps), '[]'::jsonb),
    'entities', coalesce((select jsonb_agg(
        -- Nicknames and GM tags are the GM's own; details ticked "GM only" are left out.
        (data - 'revealedTo' - 'aliases' - 'gmTags' - 'revealAt') || jsonb_build_object(
          'fields', coalesce((select jsonb_agg(case when jsonb_typeof(f->'value') = 'string'
                then f || jsonb_build_object('value', public.player_links(f->>'value', (select page_names from pagenames))) else f end)
            from jsonb_array_elements(case when jsonb_typeof(data->'fields') = 'array' then data->'fields' else '[]'::jsonb end) f
            where coalesce(f->>'gm', '') <> 'true'), '[]'::jsonb),
          'gmNotes', '',
          -- Pages revealed only to this viewer arrive as ordinary revealed pages, flagged so the app can say so.
          'visibility', 'players',
          'secretForYou', data->>'visibility' <> 'players' and not public.reveal_due(data),
          'body', public.player_links(public.player_text(data->>'body', names), (select page_names from pagenames)),
          'playerBody', case when data ? 'playerBody'
            then to_jsonb(public.player_links(public.player_text(data->>'playerBody', names), (select page_names from pagenames))) else 'null'::jsonb end,
          'parentId', case when data->>'parentId' in (select id from ents) then data->'parentId' else 'null'::jsonb end,
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end,
          -- Who carries an item: the party, or a character the viewer can see.
          'heldBy', case when data->>'heldBy' = 'party' or data->>'heldBy' in (select id from ents) then data->'heldBy' else 'null'::jsonb end,
          -- A character's status (dead, missing...) only when the GM ticked "Players know this".
          'status', case when coalesce(data->>'statusKnown', '') = 'true' then coalesce(data->'status', 'null'::jsonb) else 'null'::jsonb end,
          -- Links and clocks only when the GM ticked "Players know", and links only to pages the viewer can see.
          -- A link's note loses its secret passages, like every other text.
          'relations', coalesce((select jsonb_agg(case when r ? 'note' then r || jsonb_build_object('note',
                public.player_links(public.player_text(r->>'note', names), (select page_names from pagenames))) else r end) from jsonb_array_elements(
              case when jsonb_typeof(data->'relations') = 'array' then data->'relations' else '[]'::jsonb end) r
            where r->>'known' = 'true' and r->>'to' in (select id from ents)), '[]'::jsonb),
          'clocks', coalesce((select jsonb_agg(c) from jsonb_array_elements(
              case when jsonb_typeof(data->'clocks') = 'array' then data->'clocks' else '[]'::jsonb end) c
            where c->>'known' = 'true'), '[]'::jsonb),
          -- A quest's steps and rewards only once the GM shows them, and a reward's item only if the viewer can see it.
          'objectives', coalesce((select jsonb_agg(o || jsonb_build_object('text', public.player_links(public.player_text(o->>'text', names), (select page_names from pagenames))))
            from jsonb_array_elements(case when jsonb_typeof(data->'objectives') = 'array' then data->'objectives' else '[]'::jsonb end) o
            where o->>'known' = 'true'), '[]'::jsonb),
          'rewards', coalesce((select jsonb_agg(w || jsonb_build_object(
                'text', public.player_links(public.player_text(w->>'text', names), (select page_names from pagenames)),
                'itemId', case when w->>'itemId' in (select id from ents) then w->'itemId' else 'null'::jsonb end))
            from jsonb_array_elements(case when jsonb_typeof(data->'rewards') = 'array' then data->'rewards' else '[]'::jsonb end) w
            where w->>'known' = 'true'), '[]'::jsonb)
        )
        -- >>> 20261107000000 (VIS-1): the one-line summary.
        || case when jsonb_typeof(data->'summary') = 'string'
            then jsonb_build_object('summary', public.player_links(data->>'summary', (select page_names from pagenames))) else '{}'::jsonb end
        -- A random table's lines: no "#" notes, no secret passages, and no line left empty by them.
        -- >>> 20261107000000 (VIS-6): trimmed the way the app trims them (src/tables.tsx).
        || case when jsonb_typeof(data->'entries') = 'array' then jsonb_build_object('entries', coalesce((
            select jsonb_agg(t order by n) from (
              select public.player_links(public.player_text(x, names), (select page_names from pagenames)) as t, n
              from jsonb_array_elements_text(data->'entries') with ordinality as l(x, n)
              where public.app_trim(x) not like '#%'
            ) kept where public.app_trim(t) <> ''), '[]'::jsonb))
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
          'note', public.player_links(public.player_text(data->>'note', names), (select page_names from pagenames)),
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
          'recap', public.player_links(public.player_text(data->>'recap', names), (select page_names from pagenames)),
          'highlights', coalesce((select jsonb_agg(jsonb_build_object(
                'id', h->'id', 'kind', h->'kind', 'who', h->'who',
                'text', public.player_links(public.player_text(h->>'text', names), (select page_names from pagenames))))
            from jsonb_array_elements(case when jsonb_typeof(data->'highlights') = 'array' then data->'highlights' else '[]'::jsonb end) h), '[]'::jsonb),
          'notes', '',
          'recordings', '[]'::jsonb,
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb),
          -- Who was there: only player characters the viewer can see.
          'present', coalesce((select jsonb_agg(p) from jsonb_array_elements_text(
              case when jsonb_typeof(data->'present') = 'array' then data->'present' else '[]'::jsonb end) p
            where p in (select id from ents where data->>'type' = 'pc')), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    -- How far the party's name (and each character's) has spread (20261103000003_reputation.sql).
    -- Rebuilt from a list of safe fields, like sessions: the reach, the lean and the ladder's level names,
    -- plus only the place notes and the reasons the GM ticked "Players can see" (known), each through
    -- player_text. A character's own reputation goes only to someone who can see that character's page;
    -- a note's place page and a change's session only when the viewer can see them.
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
                'place', public.player_links(public.player_text(n->>'place', names), (select page_names from pagenames)),
                'text', public.player_links(public.player_text(n->>'text', names), (select page_names from pagenames)),
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
                'reason', public.player_links(public.player_text(h->>'reason', names), (select page_names from pagenames)),
                'sessionId', case when h->>'sessionId' in (select id from ses) then h->'sessionId' else 'null'::jsonb end) order by k)
            from jsonb_array_elements(case when jsonb_typeof(r.data->'history') = 'array' then r.data->'history' else '[]'::jsonb end) with ordinality as hl(h, k)
            where h->>'known' = 'true'), '[]'::jsonb),
          'createdAt', r.data->'createdAt',
          'updatedAt', r.data->'updatedAt'))
        from live r
        where r.table_name = 'reputation' and (r.data->>'of' = 'party' or r.data->>'of' in (select id from ents))), '[]'::jsonb),
    -- >>> 20261107000000 (VIS-9): each file from a list of safe fields, with a plain name and no tags, and
    -- the id of its own row (what the shared-asset function builds the storage path from).
    'assets', coalesce((select jsonb_agg(
        coalesce((select jsonb_object_agg(k, v) from jsonb_each(a.data) as d(k, v)
          where k in ('worldId', 'mime', 'size', 'visibility', 'createdAt', 'updatedAt')), '{}'::jsonb)
        || jsonb_build_object(
          'id', to_jsonb(a.id),
          'name', case
            when a.data->>'mime' like 'image/%' then 'Picture'
            when a.data->>'mime' like 'audio/%' then 'Sound'
            when a.data->>'mime' like 'video/%' then 'Video'
            else 'File' end,
          'tags', '[]'::jsonb))
      from assets a), '[]'::jsonb),
    -- <<< 20261107000000
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid, uuid) from public, anon, authenticated;

-- ---------- names ----------

-- As in 20261106000000_rename_players.sql, plus: no control characters, none of the invisible or
-- right-to-left ones that make a name look like someone else's (U+202E turns text backwards, U+200B
-- is a space you can't see), and something visible to read. Joiners (U+200C, U+200D) are fine where
-- emoji and some scripts need them, but never beside plain letters and digits.
create or replace function public.member_name_ok(name text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(trim(name), '') <> '' and coalesce(name, '') !~* '(://|^www\.|/join/)'
    and coalesce(name, '') !~ '[\u0001-\u001f\u007f-\u009f\u00ad\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0000-\U000e001f\U000e0080-\U000e00ff\U000e01f0-\U000e0fff]'
    and coalesce(name, '') !~ '(^|[\u0001-\u007f])[\u200c\u200d]|[\u200c\u200d]([\u0001-\u007f]|$)'
    and public.member_name_key(name) <> ''
$$;

-- As in 20261106000000_rename_players.sql, plus: a clearer message for a name with a hidden character,
-- and nobody can take a name someone else in the world already has.
create or replace function public.rename_member(wid uuid, uid uuid, name text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := left(trim(coalesce(name, '')), 60);
begin
  if me is null or wid is null or uid is null then
    raise exception 'Sign in first.';
  end if;
  if not public.member_name_ok(clean) then
    if clean <> '' and clean !~* '(://|^www\.|/join/)' then
      raise exception 'That name has a hidden or unusual character in it (copying and pasting can bring one along). Type the name in yourself.';
    end if;
    raise exception 'Type a name for the table, not a link.';
  end if;
  if not (public.is_world_gm(wid) or (uid = me and public.is_world_member(wid))) then
    raise exception 'Only the GM can rename someone else.';
  end if;
  if exists (select 1 from public.world_members m
             where m.world_id = wid and m.user_id <> uid and public.member_name_key(m.display_name) = public.member_name_key(clean)) then
    raise exception 'Someone in this world already goes by that name. Pick another (adding an initial works).';
  end if;
  update public.world_members set display_name = clean where world_id = wid and user_id = uid;
  if not found then
    raise exception 'That person isn''t in this world any more.';
  end if;
end $$;
revoke execute on function public.rename_member(uuid, uuid, text) from public, anon;
grant execute on function public.rename_member(uuid, uuid, text) to authenticated;

-- Joining with either link, as in 20261106000000_rename_players.sql, plus: a name someone else in the
-- world already has is refused (so they can pick another), and a co-GM link works once (choice 4a): it's
-- turned off as soon as someone joins with it. Opening your own world's link changes nothing.
create or replace function public.join_world(token text, name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  wid uuid;
  as_role text;
  me uuid := auth.uid();
  clean text := left(coalesce(trim(name), ''), 60);
begin
  if me is null or token is null or length(token) < 20 then
    return null;
  end if;
  if not public.member_name_ok(clean) then
    clean := '';
  end if;
  select id, 'player' into wid, as_role from public.cloud_worlds where invite_token = token;
  if wid is null then
    -- Locked until this join is done, so two people can't both use one co-GM link at the same moment.
    select world_id, 'gm' into wid, as_role from public.gm_invites g where g.token = join_world.token for update;
  end if;
  if wid is null then
    return null;
  end if;
  if public.is_world_gm(wid) then
    return wid;
  end if;
  if clean <> ''
     and exists (select 1 from public.world_members m
                 where m.world_id = wid and m.user_id <> me and public.member_name_key(m.display_name) = public.member_name_key(clean))
     and not exists (select 1 from public.world_members m
                     where m.world_id = wid and m.user_id = me and public.member_name_key(m.display_name) = public.member_name_key(clean)) then
    raise exception 'Someone in this world already goes by that name. Pick another (adding an initial works).';
  end if;
  insert into public.world_members (world_id, user_id, role, display_name)
  values (wid, me, as_role, clean)
  on conflict (world_id, user_id) do update set
    role = case when excluded.role = 'gm' then 'gm' else public.world_members.role end,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.world_members.display_name end;
  if as_role = 'gm' then
    delete from public.gm_invites g where g.token = join_world.token;
  end if;
  return wid;
end $$;
revoke execute on function public.join_world(text, text) from public, anon;
grant execute on function public.join_world(text, text) to authenticated;

-- ---------- synced rows match what's inside them (FILE-2) ----------

-- Every row the app syncs carries its own id and its world's id (src/cloud/sync.ts, toData), and the
-- world's own row is filed under the world's id. A deleted row (no data) is fine as it is.
create or replace function public.records_check_ids() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.data is not null and (
    jsonb_typeof(new.data) <> 'object'
    or new.data->>'id' is distinct from new.id
    or case when new.table_name = 'worlds' then new.id is distinct from new.world_id::text
            else new.data->>'worldId' is distinct from new.world_id::text end
  ) then
    raise exception 'This doesn''t match the world it was saved to (its id or world inside is different), so the cloud didn''t take it.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.records_check_ids() from public, anon, authenticated;
create or replace trigger records_check_ids before insert or update on public.records
  for each row execute function public.records_check_ids();

-- ---------- members join only with a link (MEM-1) ----------

-- Owners still see and remove the people in their worlds; adding someone, or changing who a row is
-- for, only happens through join_world (and the app never does either directly).
alter policy "owners manage members" on public.world_members with check (false);

-- ---------- table rights (PRIV-10) ----------

-- Row security can't stop TRUNCATE, and nobody but the database itself needs REFERENCES or TRIGGER.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
-- Postgres 17 adds MAINTAIN (VACUUM, LOCK and the like), which the same default rights hand out.
do $$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;

-- ---------- file size (FILE-7) ----------

-- 50 MB a file, what the app already tells GMs (src/cloud/sync.ts, uploadProblem).
update storage.buckets set file_size_limit = 52428800 where id = 'assets' and file_size_limit is distinct from 52428800;
