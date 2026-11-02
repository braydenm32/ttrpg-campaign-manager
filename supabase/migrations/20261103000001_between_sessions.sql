-- Between sessions (the first ten minutes and the between-sessions loop). Safe to run more than once;
-- the app works before and after it (before: no stars and wishes, no notes on sessions, players don't
-- see who was there, and a page waiting for its "reveal on" date simply stays GM only).
--  - Timed reveals: a page (or a handout) can carry "revealAt", a time in milliseconds. The page stays
--    GM only in the GM's own copy until then; from that moment players get it like any revealed page.
--    entity_visible_to (used by player_view, notes, questions and claims) does the check, so it is now
--    "stable" (it reads the clock) instead of "immutable".
--  - player_view: as in 20261102000000_review_round5.sql apart from: handouts wait for their date,
--    "revealAt" is never sent, a page that appeared on its date isn't flagged "revealed to you alone",
--    and sessions carry "present" (who was there), only for player characters the viewer can see.
--  - Players' own notes on a session: save_player_note and member_world accept a session players can
--    see as well as a page (the note's entity_id is then the session's id).
--  - Stars and wishes: after a session each player can tell the GM one thing they loved and one they'd
--    like more of. Named, private to the GM, like downtime (new table session_feedback, written only
--    through send_feedback).

-- ---------- timed reveals ----------

create or replace function public.reveal_due(data jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(data->>'revealAt', '') ~ '^\d{1,15}$'
    and (data->>'revealAt')::bigint <= (extract(epoch from now()) * 1000)::bigint
$$;
revoke execute on function public.reveal_due(jsonb) from public, anon;

create or replace function public.entity_visible_to(data jsonb, viewer uuid) returns boolean
language sql stable set search_path = '' as $$
  select data->>'visibility' = 'players'
      or (viewer is not null and coalesce(data->'revealedTo', '[]'::jsonb) ? viewer::text)
      or public.reveal_due(data)
$$;
revoke execute on function public.entity_visible_to(jsonb, uuid) from public, anon;

-- A session players can see: marked for players, in a campaign players can see.
create or replace function public.session_visible(wid uuid, sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.records s
    join public.records c on c.world_id = s.world_id and c.table_name = 'campaigns' and c.id = s.data->>'campaignId' and not c.deleted
    where s.world_id = wid and s.table_name = 'sessions' and s.id = sid and not s.deleted
      and s.data->>'visibility' = 'players' and coalesce(c.data->>'visibility', 'players') = 'players'
  )
$$;
revoke execute on function public.session_visible(uuid, text) from public, anon, authenticated;

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
        (data - 'revealedTo' - 'aliases' - 'gmTags' - 'revealAt') || jsonb_build_object(
          'fields', coalesce((select jsonb_agg(f) from jsonb_array_elements(
              case when jsonb_typeof(data->'fields') = 'array' then data->'fields' else '[]'::jsonb end) f
            where coalesce(f->>'gm', '') <> 'true'), '[]'::jsonb),
          'gmNotes', '',
          -- Pages revealed only to this viewer arrive as ordinary revealed pages, flagged so the app can say so.
          'visibility', 'players',
          'secretForYou', data->>'visibility' <> 'players' and not public.reveal_due(data),
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
          'entityIds', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(data->'entityIds') e where e in (select id from ents)), '[]'::jsonb),
          -- Who was there: only player characters the viewer can see.
          'present', coalesce((select jsonb_agg(p) from jsonb_array_elements_text(
              case when jsonb_typeof(data->'present') = 'array' then data->'present' else '[]'::jsonb end) p
            where p in (select id from ents where data->>'type' = 'pc')), '[]'::jsonb)
        )) from ses), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(data) from assets), '[]'::jsonb),
    'updatedAt', (select max(updated_at) from public.records where world_id = wid)
  ) into result;
  return result;
end $$;
revoke execute on function public.player_view(uuid, uuid) from public, anon, authenticated;

-- ---------- players' notes on sessions ----------

-- As in 20261029010000_review_fixes.sql, plus: the note can be on a session the player can see.
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
    if (d is null or not public.entity_visible_to(d, me)) and not public.session_visible(wid, eid) then
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

-- As in 20261025000000_audit_fixes.sql, plus: notes on sessions the player can see come back too.
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
    'name', (select name from public.cloud_worlds where id = wid),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', m.display_name, 'role', m.role))
      from public.world_members m where m.world_id = wid), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('entityId', c.entity_id, 'userId', c.user_id, 'notes', c.player_notes, 'approved', c.approved))
      from public.character_claims c where c.world_id = wid and public.claimable_character(wid, c.entity_id, me)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
        'entityId', n.entity_id, 'shared', n.scope = 'group', 'body', n.body, 'updatedBy', n.updated_by, 'updatedAt', n.updated_at))
      from public.player_notes n
      where n.world_id = wid and (n.scope = 'group' or n.scope = me::text)
        and (n.entity_id = '' or public.session_visible(wid, n.entity_id) or exists (
          select 1 from public.records r where r.world_id = wid and r.table_name = 'entities' and r.id = n.entity_id
            and not r.deleted and public.entity_visible_to(r.data, me)))), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(jsonb_build_object('optionId', a.option_id, 'userId', a.user_id, 'answer', a.answer))
      from public.availability a where a.world_id = wid), '[]'::jsonb),
    -- Your own questions to the GM and the answers; nobody else's.
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'entityId', q.entity_id, 'body', q.body, 'answer', q.answer, 'answeredAt', q.answered_at, 'createdAt', q.created_at))
      from public.player_questions q
      where q.world_id = wid and q.user_id = me
        and (q.entity_id = '' or exists (
          select 1 from public.records r where r.world_id = wid and r.table_name = 'entities' and r.id = q.entity_id
            and not r.deleted and public.entity_visible_to(r.data, me)))), '[]'::jsonb)
  );
end $$;
revoke execute on function public.member_world(uuid) from public, anon;
grant execute on function public.member_world(uuid) to authenticated;

-- ---------- stars and wishes ----------

create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null,
  user_id uuid not null,
  -- The GM's id of the session it's about.
  session_id text not null check (length(session_id) <= 200),
  -- The character it's signed with, by name ('' for none). Stars and wishes are named, not anonymous.
  character text not null default '' check (length(character) <= 200),
  star text not null default '' check (length(star) <= 2000),
  wish text not null default '' check (length(wish) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, user_id, session_id),
  foreign key (world_id, user_id) references public.world_members (world_id, user_id) on delete cascade
);
create index if not exists session_feedback_world on public.session_feedback (world_id, created_at);
alter table public.session_feedback enable row level security;

drop policy if exists "gms read feedback" on public.session_feedback;
create policy "gms read feedback" on public.session_feedback for select to authenticated using (public.is_world_gm(world_id));
drop policy if exists "players read own feedback" on public.session_feedback;
create policy "players read own feedback" on public.session_feedback for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "gms delete feedback" on public.session_feedback;
create policy "gms delete feedback" on public.session_feedback for delete to authenticated using (public.is_world_gm(world_id));
drop policy if exists "players take back feedback" on public.session_feedback;
create policy "players take back feedback" on public.session_feedback for delete to authenticated using (user_id = (select auth.uid()));
-- Players write through send_feedback; nobody inserts or changes rows directly.
revoke all on public.session_feedback from anon;
revoke insert, update on public.session_feedback from authenticated;
grant select, delete on public.session_feedback to authenticated;

-- One star and one wish per player per session; sending again replaces them.
create or replace function public.send_feedback(wid uuid, sid text, who text, star text, wish text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  fid uuid;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = me and m.role = 'player') then
    raise exception 'Only players in this world can send stars and wishes.';
  end if;
  if not public.session_visible(wid, sid) then
    raise exception 'That session isn''t available.';
  end if;
  if coalesce(trim(star), '') = '' and coalesce(trim(wish), '') = '' then
    raise exception 'Write a star or a wish first.';
  end if;
  insert into public.session_feedback (world_id, user_id, session_id, character, star, wish)
  values (wid, me, sid, left(coalesce(trim(who), ''), 200), left(coalesce(trim(star), ''), 2000), left(coalesce(trim(wish), ''), 2000))
  on conflict (world_id, user_id, session_id) do update
    set character = excluded.character, star = excluded.star, wish = excluded.wish, updated_at = now()
  returning id into fid;
  return fid;
end $$;
revoke execute on function public.send_feedback(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_feedback(uuid, text, text, text, text) to authenticated;
