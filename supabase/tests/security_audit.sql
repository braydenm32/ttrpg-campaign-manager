-- Tests 20261107000000_security_audit.sql on a scratch database, as the owner GM, a co-GM, players, a
-- stranger and a signed-out reader, and compares what every kind of viewer receives before and after.
-- How to run it: supabase/tests/README.md (run.sh does it all). It needs an empty database owned by
-- "postgres" with stubs.sql already loaded by a superuser, and is run as "postgres":
--   psql -U postgres -d atlas -v example=/tmp/example-world.sql -f supabase/tests/security_audit.sql
-- "example" (optional) is the example world as rows, from example-world.mjs. It stops with an error
-- if any check fails, after listing them.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- Everything up to the fix, as it is live (and map packs, which are not live yet).
\ir ../migrations/20261022000000_cloud_sync_and_sharing.sql
\ir ../migrations/20261022010000_share_sessions_allowlist.sql
\ir ../migrations/20261022020000_player_invites.sql
\ir ../migrations/20261022030000_player_secrets_and_notes.sql
\ir ../migrations/20261022040000_for_passage_names.sql
\ir ../migrations/20261022050000_cogm_schedule_loot.sql
\ir ../migrations/20261022060000_boards_sounds_status_questions.sql
\ir ../migrations/20261023000000_fog_showing_relations_clocks.sql
\ir ../migrations/20261025000000_audit_fixes.sql
\ir ../migrations/20261025010000_features.sql
\ir ../migrations/20261026000000_round_two.sql
\ir ../migrations/20261026100000_delete_my_account.sql
\ir ../migrations/20261028000000_cover_without_reveal.sql
\ir ../migrations/20261028010000_map_secrets.sql
\ir ../migrations/20261029000000_gm_replies_and_new_characters.sql
\ir ../migrations/20261029010000_review_fixes.sql
\ir ../migrations/20261029020000_ai_keys.sql
\ir ../migrations/20261030000000_new_features.sql
\ir ../migrations/20261102000000_review_round5.sql
\ir ../migrations/20261103000001_between_sessions.sql
\ir ../migrations/20261103000003_reputation.sql
\ir ../migrations/20261105000000_map_packs.sql
\ir ../migrations/20261106000000_rename_players.sql

\ir lib.sql
\ir seed.sql
\if :{?example}
\i :example
-- Vera plays Varra Nine-Knuckles and Quinn plays Quorl Many-Words.
insert into public.character_claims (world_id, entity_id, user_id, approved)
select world_id, id, case data->>'name' when 'Varra Nine-Knuckles' then t.who('vera') else t.who('quinn') end, true
from public.records
where world_id = '20000000-0000-4000-8000-000000000002' and table_name = 'entities' and data->>'name' in ('Varra Nine-Knuckles', 'Quorl Many-Words');
\echo 'Loaded the example world.'
\else
\echo 'No example world given (-v example=...): checking Test Realm only.'
insert into public.records (world_id, table_name, id, data) values ('20000000-0000-4000-8000-000000000002', 'worlds', '20000000-0000-4000-8000-000000000002',
  '{"id": "20000000-0000-4000-8000-000000000002", "name": "Vael Ardith"}');
\endif

-- Results go to the summary at the end, not one by one.
\o /dev/null
\set phase before
\ir snapshot.sql
\ir ../migrations/20261107000000_security_audit.sql
\set phase after
\ir snapshot.sql
-- A second run must change nothing.
\ir ../migrations/20261107000000_security_audit.sql
\set phase again
\ir snapshot.sql

\ir checks.sql
\o

\pset footer off
\echo
\echo 'What changed in what each viewer receives, by fix:'
select label as "view", coalesce(why, 'NOT EXPLAINED') as "change", count(*) as "places" from t.diffs group by 1, 2 order by 1, 2;
\echo 'Checks that failed (none is good):'
select seq as "#", name as "check", detail from t.results where not ok order by seq;
select count(*) filter (where ok) as "passed", count(*) filter (where not ok) as "failed" from t.results;
do $$
declare
  bad integer := (select count(*) from t.results where not ok);
begin
  if bad > 0 then
    raise exception '% of % checks failed', bad, (select count(*) from t.results);
  end if;
end $$;
