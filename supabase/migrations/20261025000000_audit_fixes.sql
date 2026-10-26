-- Fixes from the October 2026 review.
--  - Secret passages can sit inside each other: a ":::" closes the innermost one, so a ":::for"
--    passage inside a ":::gm" block no longer ends the GM block early (which sent the rest of it to
--    every player), and a ":::gm" inside a ":::for" passage stays hidden from that player too.
--    Markers forgive case, spaces and indenting (":::GM", "::: gm", "  :::gm"), so a typo can't leak.
--  - A one-line ":::for Wren::: text :::" reaches Wren's player as a three-line ":::foryou" passage
--    (it used to arrive as ":::foryoutext:::", which the app couldn't read).
--  - Character claims wait for the GM: a player asks, the GM approves. Only approved claims count
--    for ":::for" passages and for editing a character. Claims made before this stay approved.
--  - Players can no longer read their world's cloud_worlds row, which holds the invite and share
--    links. They get the world's name from my_memberships() and member_world() instead.
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
  foreach line in array string_to_array(replace(t, E'\r', ''), E'\n') loop
    skipping := 'skip' = any(stack);
    op := regexp_match(line, '^[ \t]*:::[ \t]*(foryou|gm|for)(?![a-z0-9])(.*)$', 'i');
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

-- ---------- character claims wait for the GM ----------

alter table public.character_claims add column if not exists approved boolean not null default true;
alter table public.character_claims alter column approved set default false;

create policy "gms approve claims" on public.character_claims for update to authenticated
  using (public.is_world_gm(world_id)) with check (public.is_world_gm(world_id));

-- Only characters the GM has approved count.
create or replace function public.viewer_names(wid uuid, viewer uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct n), '{}') from public.character_claims c
    join public.records r on r.world_id = c.world_id and r.table_name = 'entities' and r.id = c.entity_id and not r.deleted
    cross join lateral (values (trim(r.data->>'name')), (split_part(trim(r.data->>'name'), ' ', 1))) v(n)
  where c.world_id = wid and c.user_id = viewer and c.approved and n <> ''
$$;
revoke execute on function public.viewer_names(uuid, uuid) from public, anon, authenticated;

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
          'fields', clean,
          'playerBody', left(coalesce(player_body, ''), 20000),
          'updatedAt', (extract(epoch from now()) * 1000)::bigint),
        updated_by = me
    where r.world_id = wid and r.table_name = 'entities' and r.id = eid and not r.deleted;
end $$;
revoke execute on function public.edit_my_character(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.edit_my_character(uuid, text, text, jsonb, text) to authenticated;

-- ---------- players don't see the world's links ----------

drop policy if exists "members can see worlds they belong to" on public.cloud_worlds;
create policy "gms can see worlds they help run" on public.cloud_worlds for select to authenticated
  using (public.is_world_gm(id));

-- Worlds you've joined as a player, with their names.
create or replace function public.my_memberships() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('cloudId', m.world_id, 'name', w.name)), '[]'::jsonb)
  from public.world_members m join public.cloud_worlds w on w.id = m.world_id
  where m.user_id = auth.uid() and m.role = 'player'
$$;
revoke execute on function public.my_memberships() from public, anon;
grant execute on function public.my_memberships() to authenticated;

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
revoke execute on function public.member_world(uuid) from public, anon;
grant execute on function public.member_world(uuid) to authenticated;
