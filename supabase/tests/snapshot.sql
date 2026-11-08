-- Saves what each kind of viewer receives, as phase :'phase' (before / after / again), for checks.sql.
-- player_view is called as the database owner (as shared_world and member_world do); shared_world and
-- member_world are called the way the app calls them: signed out with the share link, or signed in.
insert into t.snap (phase, label, view)
select :'phase', label, public.player_view(w::uuid, who::uuid) from (values
  ('W1 anon', '10000000-0000-4000-8000-000000000001', null),
  ('W1 p1', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1'),
  ('W1 p2', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2'),
  ('W1 p3', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b3'),
  ('W1 cogm', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2'),
  ('VA anon', '20000000-0000-4000-8000-000000000002', null),
  ('VA pv1', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b4'),
  ('VA pv2', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b5')
) x(label, w, who);

-- The function definitions this migration replaces: their arguments, rights and settings must not change.
insert into t.snap (phase, label, view)
select :'phase', 'functions', jsonb_object_agg(p.oid::regprocedure::text, jsonb_build_object(
    'args', pg_get_function_arguments(p.oid), 'returns', pg_get_function_result(p.oid), 'acl', p.proacl::text,
    'definer', p.prosecdef, 'volatility', p.provolatile, 'config', p.proconfig, 'owner', p.proowner::regrole::text))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('player_view', 'player_text', 'member_name_ok', 'rename_member', 'join_world', 'member_world', 'shared_world', 'set_player_notes');

-- Table rights, to show which ones the migration takes away.
insert into t.snap (phase, label, view)
select :'phase', 'table rights', jsonb_object_agg(c.relname, c.relacl::text)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- A public wiki link, signed out.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into t.snap (phase, label, view) values
  (:'phase', 'W1 shared_world', public.shared_world('w1-share-token-0123456789abcdef')),
  (:'phase', 'VA shared_world', public.shared_world('va-share-token-0123456789abcdef'));
reset role;

-- Joined players, signed in.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', false);
set role authenticated;
insert into t.snap (phase, label, view) values (:'phase', 'W1 member_world p1', public.member_world('10000000-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', false);
set role authenticated;
insert into t.snap (phase, label, view) values (:'phase', 'W1 member_world p2', public.member_world('10000000-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', false);
set role authenticated;
insert into t.snap (phase, label, view) values (:'phase', 'W1 member_world stranger', public.member_world('10000000-0000-4000-8000-000000000001'));
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b4', false);
set role authenticated;
insert into t.snap (phase, label, view) values (:'phase', 'VA member_world pv1', public.member_world('20000000-0000-4000-8000-000000000002'));
reset role;
select set_config('request.jwt.claim.sub', '', false);
