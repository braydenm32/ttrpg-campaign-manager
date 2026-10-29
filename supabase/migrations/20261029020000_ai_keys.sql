-- AI keys saved to a person's account (opt-in, "Save to my account" in World settings → AI tools),
-- so every device they sign in on picks them up. Only the owner can read or change their row: no
-- world, share link, player_view, backup or other person ever reaches it. Deleting the account
-- removes the row with it.
create table if not exists public.ai_keys (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  anthropic_key text not null default '' check (length(anthropic_key) <= 500),
  assembly_key text not null default '' check (length(assembly_key) <= 500),
  updated_at timestamptz not null default now()
);
drop trigger if exists ai_keys_touch on public.ai_keys;
create trigger ai_keys_touch before update on public.ai_keys for each row execute function public.touch_updated_at();
alter table public.ai_keys enable row level security;
revoke all on public.ai_keys from anon, public;
grant select, insert, update, delete on public.ai_keys to authenticated;
drop policy if exists "people keep their own ai keys" on public.ai_keys;
create policy "people keep their own ai keys" on public.ai_keys for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
