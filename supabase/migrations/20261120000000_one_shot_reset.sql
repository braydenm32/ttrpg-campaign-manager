-- One-shot mode (src/oneShot.ts): "Reset for the next table" clears the players' group notes and
-- party scratchpad, so the next group doesn't read the last one's.
--  - clear_group_notes: a GM of the world (its owner or a co-GM) deletes the world's shared notes
--    (player_notes with scope 'group', the scratchpad being entity_id ''). Players' private notes
--    already go when they're removed from the world (world_members_drop_notes).
-- player_view is unchanged: the one-shot setting lives in the world's gmScreen, which it never sends.
-- Safe to run more than once. Without it the app still works; the reset says the group notes
-- couldn't be cleared.

create or replace function public.clear_group_notes(wid uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null or wid is null then
    raise exception 'Sign in first.';
  end if;
  if not public.is_world_gm(wid) then
    raise exception 'Only the GM can clear the group notes.';
  end if;
  delete from public.player_notes where world_id = wid and scope = 'group';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.clear_group_notes(uuid) from public, anon;
grant execute on function public.clear_group_notes(uuid) to authenticated;
