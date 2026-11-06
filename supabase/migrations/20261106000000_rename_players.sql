-- Renaming people who joined a world (a typo, or a pasted invite link where the name should be).
--  - rename_member: a GM of the world (its owner or a co-GM) renames anyone who joined it; a player
--    or co-GM renames themselves. Names are 1 to 60 characters and can't be a web address.
--  - join_world: a name that looks like a web address is ignored (an old name stays, a new player
--    shows as "Unnamed player" until renamed), so a link pasted into the name box can't stick.
-- player_view is unchanged: display names already reach players through member_world's "members".
-- Safe to run more than once. Without it the app still works; renaming shows an error.

create or replace function public.member_name_ok(name text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(trim(name), '') <> '' and coalesce(name, '') !~* '(://|^www\.|/join/)'
$$;

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
    raise exception 'Type a name for the table, not a link.';
  end if;
  if not (public.is_world_gm(wid) or (uid = me and public.is_world_member(wid))) then
    raise exception 'Only the GM can rename someone else.';
  end if;
  update public.world_members set display_name = clean where world_id = wid and user_id = uid;
  if not found then
    raise exception 'That person isn''t in this world any more.';
  end if;
end $$;
revoke execute on function public.rename_member(uuid, uuid, text) from public, anon;
grant execute on function public.rename_member(uuid, uuid, text) to authenticated;

-- Joining with either link. The player link makes you a player; the co-GM link makes you a GM
-- (and promotes you if you'd already joined as a player). Same as before, except for the name check.
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
    select world_id, 'gm' into wid, as_role from public.gm_invites g where g.token = join_world.token;
  end if;
  if wid is null then
    return null;
  end if;
  if public.is_world_gm(wid) then
    return wid;
  end if;
  insert into public.world_members (world_id, user_id, role, display_name)
  values (wid, me, as_role, clean)
  on conflict (world_id, user_id) do update set
    role = case when excluded.role = 'gm' then 'gm' else public.world_members.role end,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.world_members.display_name end;
  return wid;
end $$;
revoke execute on function public.join_world(text, text) from public, anon;
grant execute on function public.join_world(text, text) to authenticated;
