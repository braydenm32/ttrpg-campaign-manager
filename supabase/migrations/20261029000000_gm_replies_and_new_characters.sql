-- Two additions for players who joined a world:
--  - The GM can reply in the party's shared notes. A reply is a line added at the end, signed "GM".
--  - A player can write up a new character and send it to the GM. The GM approves it (their app
--    makes the character's page) or turns it down with a note. Nothing here touches public.records,
--    so what players see of the world still comes only from public.player_view().

-- ---------- GM replies in group notes ----------

create or replace function public.gm_note_reply(wid uuid, eid text, line text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  t text := left(regexp_replace(trim(coalesce(line, '')), E'[\\r\\n]+', ' ', 'g'), 2000);
begin
  if not public.is_world_gm(wid) then
    raise exception 'Only the GM can reply in the party''s notes.';
  end if;
  if t = '' then
    return;
  end if;
  insert into public.player_notes (world_id, entity_id, scope, body, updated_by)
  values (wid, coalesce(eid, ''), 'group', '- **GM:** ' || t, auth.uid())
  on conflict (world_id, entity_id, scope) do update
    set body = left(
          case when public.player_notes.body ~ '^\s*$' then '' else rtrim(public.player_notes.body, E' \n') || E'\n' end || excluded.body,
          50000),
        updated_by = excluded.updated_by;
end $$;
revoke execute on function public.gm_note_reply(uuid, text, text) from public, anon;
grant execute on function public.gm_note_reply(uuid, text, text) to authenticated;

-- ---------- players' new characters ----------

create table if not exists public.character_requests (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.cloud_worlds (id) on delete cascade,
  user_id uuid not null,
  -- { name, summary, fields: [{ key, value }], playerBody }
  sheet jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  gm_note text not null default '',
  -- The GM's page for the character, once approved.
  entity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Leaving (or being removed from) a world drops their requests too.
  foreign key (world_id, user_id) references public.world_members (world_id, user_id) on delete cascade
);
create index if not exists character_requests_world on public.character_requests (world_id, status);
drop trigger if exists character_requests_touch on public.character_requests;
create trigger character_requests_touch before update on public.character_requests for each row execute function public.touch_updated_at();
alter table public.character_requests enable row level security;
grant select on public.character_requests to authenticated;
drop policy if exists "players see their own character requests" on public.character_requests;
create policy "players see their own character requests" on public.character_requests for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "gms see character requests" on public.character_requests;
create policy "gms see character requests" on public.character_requests for select to authenticated
  using (public.is_world_gm(world_id));

-- A player sends a new character. Only the parts a character sheet has are kept, each trimmed to size.
create or replace function public.request_character(wid uuid, sheet jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  nm text := left(trim(coalesce(sheet->>'name', '')), 120);
  clean jsonb;
  rid uuid;
begin
  if not exists (select 1 from public.world_members m where m.world_id = wid and m.user_id = me and m.role = 'player') then
    raise exception 'Only players in this world can send a new character.';
  end if;
  if nm = '' then
    raise exception 'Give your character a name.';
  end if;
  if (select count(*) from public.character_requests r where r.world_id = wid and r.user_id = me and r.status = 'pending') >= 3 then
    raise exception 'You already have characters waiting for your GM. Wait for an answer, or take one back.';
  end if;
  clean := jsonb_build_object(
    'name', nm,
    'summary', left(coalesce(sheet->>'summary', ''), 300),
    'playerBody', left(coalesce(sheet->>'playerBody', ''), 20000),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object('key', left(coalesce(f->>'key', ''), 60), 'value', left(coalesce(f->>'value', ''), 300)))
      from (select f from jsonb_array_elements(case when jsonb_typeof(sheet->'fields') = 'array' then sheet->'fields' else '[]'::jsonb end) f limit 30) x
      where coalesce(f->>'key', '') <> '' or coalesce(f->>'value', '') <> ''
    ), '[]'::jsonb)
  );
  insert into public.character_requests (world_id, user_id, sheet) values (wid, me, clean) returning id into rid;
  return rid;
end $$;
revoke execute on function public.request_character(uuid, jsonb) from public, anon;
grant execute on function public.request_character(uuid, jsonb) to authenticated;

-- A player takes back a character they sent (or clears an answered one).
create or replace function public.withdraw_character_request(rid uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.character_requests r where r.id = rid and r.user_id = (select auth.uid()) and r.status <> 'approved';
$$;
revoke execute on function public.withdraw_character_request(uuid) from public, anon;
grant execute on function public.withdraw_character_request(uuid) to authenticated;

-- The GM answers. Approving gives the player the page the GM's app just made for the character
-- (eid), already approved, so it's theirs straight away.
create or replace function public.answer_character_request(rid uuid, approve boolean, note text, eid text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  req public.character_requests;
begin
  select * into req from public.character_requests r where r.id = rid for update;
  if not found or not public.is_world_gm(req.world_id) then
    raise exception 'That request isn''t there any more.';
  end if;
  if req.status <> 'pending' then
    return;
  end if;
  if approve then
    if coalesce(eid, '') = '' then
      raise exception 'The character''s page is missing.';
    end if;
    insert into public.character_claims (world_id, entity_id, user_id, approved)
    values (req.world_id, eid, req.user_id, true)
    on conflict (world_id, entity_id) do update set user_id = excluded.user_id, approved = true;
    update public.character_requests set status = 'approved', entity_id = eid, gm_note = left(coalesce(note, ''), 2000) where id = rid;
  else
    update public.character_requests set status = 'declined', gm_note = left(coalesce(note, ''), 2000) where id = rid;
  end if;
end $$;
revoke execute on function public.answer_character_request(uuid, boolean, text, text) from public, anon;
grant execute on function public.answer_character_request(uuid, boolean, text, text) to authenticated;
