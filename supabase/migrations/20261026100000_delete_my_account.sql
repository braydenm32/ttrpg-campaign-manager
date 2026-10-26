-- Let people delete their own account from the app (Australian Privacy Principles 11 and 13:
-- don't keep personal information you no longer need, and make deleting it easy).
--
-- The app first deletes the cloud copy (and uploaded files) of every world the person owns, then
-- calls this. Removing the auth.users row cascades to everything else tied to the person:
-- worlds they own, their memberships, claimed characters, private notes, questions and availability.
create or replace function public.delete_my_account() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
