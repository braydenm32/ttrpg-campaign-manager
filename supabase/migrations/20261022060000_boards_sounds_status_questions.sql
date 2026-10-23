-- Corkboards, the soundboard, character status and players' questions.
--  - Corkboards and soundboard buttons sync as two new kinds of record. player_view never reads them,
--    so they stay GM-only.
--  - player_view: a character's status (dead, missing, captured) reaches players only when the GM
--    ticked "Players know this" (statusKnown).
--  - Players' questions: a player asks the GM something, about a page they can see or about
--    anything; only GMs read the questions, and only the player who asked sees the answer (through
--    member_world).

alter table public.records drop constraint if exists records_table_name_check;
alter table public.records add constraint records_table_name_check
  check (table_name in ('worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds'));

create table if not exists public.player_questions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null,
  user_id uuid not null,
  -- The page asked about ('' for a general question).
  entity_id text not null default '',
  body text not null check (length(body) between 1 and 4000),
  answer text check (answer is null or length(answer) <= 8000),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (world_id, user_id) references public.world_members (world_id, user_id) on delete cascade
);
create index if not exists player_questions_world on public.player_questions (world_id, created_at);
alter table public.player_questions enable row level security;
create policy "gms read questions" on public.player_questions for select to authenticated using (public.is_world_gm(world_id));
create policy "gms answer questions" on public.player_questions for update to authenticated
  using (public.is_world_gm(world_id)) with check (public.is_world_gm(world_id));
create policy "gms delete questions" on public.player_questions for delete to authenticated using (public.is_world_gm(world_id));
-- Players ask through ask_question, take a question back through withdraw_question, and read
-- their own through member_world.

create or replace function public.ask_question(wid uuid, eid text, body text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d jsonb;
  qid uuid;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = me and m.role = 'player') then
    raise exception 'Only players in this world can ask the GM.';
  end if;
  if coalesce(trim(body), '') = '' then
    raise exception 'Write a question first.';
  end if;
  if (select count(*) from public.player_questions q where q.world_id = wid and q.user_id = me and q.answer is null) >= 50 then
    raise exception 'You have 50 questions waiting already. Give your GM a chance to answer.';
  end if;
  if coalesce(eid, '') <> '' then
    select r.data into d from public.records r where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted;
    if d is null or not public.entity_visible_to(d, me) then
      raise exception 'That page isn''t available.';
    end if;
  end if;
  insert into public.player_questions (world_id, user_id, entity_id, body)
  values (wid, me, coalesce(eid, ''), left(trim(body), 4000))
  returning id into qid;
  return qid;
end $$;
revoke execute on function public.ask_question(uuid, text, text) from public, anon;
grant execute on function public.ask_question(uuid, text, text) to authenticated;

create or replace function public.withdraw_question(qid uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.player_questions q where q.id = qid and q.user_id = auth.uid()
$$;
revoke execute on function public.withdraw_question(uuid) from public, anon;
grant execute on function public.withdraw_question(uuid) to authenticated;

create or replace function public.player_view(wid uuid, viewer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  names text[] := case when viewer is null then '{}'::text[] else public.viewer_names(wid, viewer) end;
begin
  with live as (
    select table_name, id, data from public.records where world_id = wid and not deleted and data is not null
  ),
  -- Templates are the GM's starting points, never pages players should see.
  ents as (
    select id, data from live
    where table_name = 'entities' and public.entity_visible_to(data, viewer) and coalesce(data->>'template', '') <> 'true'
  ),
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
        (data - 'revealedTo') || jsonb_build_object(
          'gmNotes', '',
          -- Pages revealed only to this viewer arrive as ordinary revealed pages, flagged so the app can say so.
          'visibility', 'players',
          'secretForYou', data->>'visibility' <> 'players',
          'body', public.player_text(data->>'body', names),
          'parentId', case when data->>'parentId' in (select id from ents) then data->'parentId' else 'null'::jsonb end,
          'imageId', case when data->>'imageId' in (select id from assets) then data->'imageId' else 'null'::jsonb end,
          -- Who carries an item: the party, or a character the viewer can see.
          'heldBy', case when data->>'heldBy' = 'party' or data->>'heldBy' in (select id from ents) then data->'heldBy' else 'null'::jsonb end,
          -- A character's status (dead, missing...) only when the GM ticked "Players know this".
          'status', case when coalesce(data->>'statusKnown', '') = 'true' then coalesce(data->'status', 'null'::jsonb) else 'null'::jsonb end
        )) from ents), '[]'::jsonb),
    'maps', coalesce((select jsonb_agg(
        (data - 'drawing') || jsonb_build_object(
          'locationId', case when data->>'locationId' in (select id from ents) then data->'locationId' else 'null'::jsonb end
        )) from maps), '[]'::jsonb),
    'pins', coalesce((select jsonb_agg(
        data || jsonb_build_object(
          'note', public.player_text(data->>'note', names),
          'entityId', case when data->>'entityId' in (select id from ents) then data->'entityId' else 'null'::jsonb end,
          'childMapId', case when data->>'childMapId' in (select id from maps) then data->'childMapId' else 'null'::jsonb end
        )) from pins), '[]'::jsonb),
    -- Sessions are rebuilt from a list of player-safe fields, so GM-only additions (notes, recordings,
    -- transcripts, recap drafts, the Lectern) can never slip through.
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
          'id', to_jsonb(id),
          'worldId', data->'worldId',
          'campaignId', data->'campaignId',
          'number', data->'number',
          'title', data->'title',
          'date', data->'date',
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
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', m.display_name, 'role', m.role))
      from public.world_members m where m.world_id = wid), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('entityId', c.entity_id, 'userId', c.user_id, 'notes', c.player_notes))
      from public.character_claims c where c.world_id = wid and public.claimable_character(wid, c.entity_id, me)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
        'entityId', n.entity_id, 'shared', n.scope = 'group', 'body', n.body, 'updatedBy', n.updated_by, 'updatedAt', n.updated_at))
      from public.player_notes n
      where n.world_id = wid and (n.scope = 'group' or n.scope = me::text)
        and (n.entity_id = '' or exists (
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

