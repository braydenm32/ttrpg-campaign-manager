-- The checks security_audit.sql runs once the migration is in. Each t.check notes one thing that must
-- hold. t.v(phase, label) is a view saved by snapshot.sql: phase 'before' (old functions), 'after' (the
-- migration) or 'again' (the migration run a second time). Worlds: W1 "Test Realm" (seed.sql,
-- 10000000-...-001), VA the example world (20000000-...-002), W2 another GM's (30000000-...-003).
-- Special characters are written as chr(code point), so this file stays plain text.

create function t.is(name text, actual text, expected text) returns void language sql as $$
  select t.check(name, actual is not distinct from expected,
    'got ' || coalesce(to_jsonb(actual)::text, 'null') || ', wanted ' || coalesce(to_jsonb(expected)::text, 'null'))
$$;
create function t.is(name text, actual jsonb, expected jsonb) returns void language sql as $$
  select t.check(name, actual is not distinct from expected,
    'got ' || coalesce(actual::text, 'null') || ', wanted ' || coalesce(expected::text, 'null'))
$$;
create function t.has(view jsonb, words text) returns boolean language sql immutable as $$
  select exists (select 1 from t.strings(view) s where strpos(lower(s), lower(words)) > 0)
$$;

-- Which views are which.
create table t.views (label text primary key, world text not null, duke_hidden boolean not null);
insert into t.views values
  ('W1 anon', 'W1', true), ('W1 p1', 'W1', false), ('W1 p2', 'W1', true), ('W1 p3', 'W1', true), ('W1 cogm', 'W1', true),
  ('W1 shared_world', 'W1', true), ('W1 member_world p1', 'W1', false), ('W1 member_world p2', 'W1', true),
  ('VA anon', 'VA', true), ('VA pv1', 'VA', true), ('VA pv2', 'VA', true), ('VA shared_world', 'VA', true), ('VA member_world pv1', 'VA', true);

-- ============ 0. The test sees the leaks the old functions had ============

select t.check('0 before: a labelled link sends a GM-only page''s real name (VIS-1)', t.has(t.v('before', 'W1 anon'), 'Duke Orlov'));
select t.check('0 before: links to pages players don''t get are found', (select array_agg(x order by x) from t.bad_links(t.v('before', 'W1 anon')) x)
  @> array['Duke Orlov', 'Masked Lich', 'Nowhere Page', 'Template NPC', 'Sister Vey']);
select t.check('0 before: an age holding only GM-only events goes out (VIS-3)', t.v('before', 'W1 anon')->'world'->'ages' @> '[{"id": "age-secret"}]');
select t.check('0 before: the GM''s file names go out (VIS-9)', t.v('before', 'W1 p1')->'assets' @> '[{"name": "duke-orlov-is-the-lich.png"}]');
select t.check('0 before: a fogged map''s clean picture is named in "showing" (SHOW-1)',
  t.v('before', 'W1 p1')->'world'->'showing'->>'assetId' = 'a1000000-0000-4000-8000-000000000004');
select t.check('0 before: a "#" note after a no-break space goes out (VIS-6)',
  t.ent(t.v('before', 'W1 anon'), 'ent-table')->'entries' @> jsonb_build_array(chr(160) || '# GM: the lich is the duke'));
select t.check('0 before: a forged "only you know" line in a write-up goes out (VIS-5)',
  strpos(t.ent(t.v('before', 'W1 p2'), 'ent-wren')->>'playerBody', ':::foryouForged') > 0);
select t.is('0 before: a lone carriage return was deleted rather than read as a line break (VIS-4)',
  t.ent(t.v('before', 'W1 anon'), 'ent-crlf3')->>'body', E'a\nbc');

-- ============ 1. VIS-1: labelled links to pages a viewer doesn't get keep only their label ============

select t.check('VIS-1: no labelled link to a page the viewer doesn''t get (' || label || ')',
  not exists (select 1 from t.bad_links(t.v('after', label))),
  coalesce((select string_agg(x, ', ') from t.bad_links(t.v('after', label)) x), ''))
from t.views;
select t.check('VIS-1: "Duke Orlov" reaches nobody he''s hidden from (' || label || ')', not t.has(t.v('after', label), 'Duke Orlov'))
from t.views where world = 'W1' and duke_hidden;
select t.check('VIS-1: a GM-only nickname reaches nobody (' || label || ')', not t.has(t.v('after', label), 'Masked Lich'))
from t.views where world = 'W1';
select t.check('VIS-1: a template''s name reaches nobody (' || label || ')', not t.has(t.v('after', label), 'Template NPC'))
from t.views where world = 'W1';
select t.check('VIS-1: "Sister Vey" only where the GM wrote her name in visible text, [[Sister Vey]] (' || label || ')',
  not exists (select 1 from t.strings(t.v('after', label)) s where strpos(replace(s, '[[Sister Vey]]', ''), 'Sister Vey') > 0))
from t.views where world = 'W1';

select t.is('VIS-1: page text, signed out', t.ent(t.v('after', 'W1 anon'), 'ent-inn')->>'body',
  'The hooded stranger drinks here. [[Old Tom]] runs it, and Old Tom knows more. [[ brindle INN |this place]] is warm. '
  || '[[Sister Vey]] prays. A lost link and [[Nowhere Page]]. A stock villain.' || E'\n' || '![](asset:a1000000-0000-4000-8000-000000000002)');
select t.is('VIS-1: page text, for the player the Duke is revealed to', t.ent(t.v('after', 'W1 p1'), 'ent-inn')->>'body',
  'The [[Duke Orlov|hooded stranger]] drinks here. [[Old Tom]] runs it, and Old Tom knows more. [[ brindle INN |this place]] is warm. '
  || '[[Sister Vey]] prays. A lost link and [[Nowhere Page]]. A stock villain.' || E'\n' || '![](asset:a1000000-0000-4000-8000-000000000002)');
select t.is('VIS-1: a revealed page''s own text', t.ent(t.v('after', 'W1 p1'), 'ent-duke')->>'body', 'A lich in disguise. Friends with a nun.');
select t.is('VIS-1: one-line summary', t.ent(t.v('after', 'W1 anon'), 'ent-inn')->>'summary', 'Run by [[Old Tom|the old man]]; a duke visits.');
select t.is('VIS-1: summary for the player who knows', t.ent(t.v('after', 'W1 p1'), 'ent-inn')->>'summary', 'Run by [[Old Tom|the old man]]; [[Duke Orlov|a duke]] visits.');
select t.is('VIS-1: details (fields)', t.ent(t.v('after', 'W1 anon'), 'ent-inn')->'fields', '[{"key": "Owner", "value": "someone"}, {"key": "Rooms", "value": "6"}]');
select t.is('VIS-1: an item''s summary', t.ent(t.v('after', 'W1 p2'), 'ent-sword')->>'summary', 'Its maker is unknown.');
select t.is('VIS-1: the world''s description', t.v('after', 'W1 anon')->'world'->>'description', 'Home of the masked duke and [[Brindle Inn|the inn]].');
select t.is('VIS-1: the story so far', (select c->>'storySoFar' from jsonb_array_elements(t.v('after', 'W1 anon')->'campaigns') c where c->>'id' = 'camp1'),
  'So far we met a stranger at [[Brindle Inn]].');
select t.is('VIS-1: a session recap', t.ent(t.v('after', 'W1 anon'), 's1', 'sessions')->>'recap', 'We met the masked man at [[Brindle Inn]].');
select t.is('VIS-1: a session highlight', t.ent(t.v('after', 'W1 p1'), 's1', 'sessions')->'highlights'->0->>'text', 'The nun lied!');
select t.is('VIS-1: a map pin''s note', t.ent(t.v('after', 'W1 anon'), 'pin-1', 'pins')->>'note', 'A figure was seen here.');
select t.is('VIS-1: quest steps', t.ent(t.v('after', 'W1 anon'), 'ent-quest')->'objectives', '[{"id": "o1", "text": "Find the duke", "known": true, "done": false}]');
select t.is('VIS-1: quest rewards', t.ent(t.v('after', 'W1 anon'), 'ent-quest')->'rewards', '[{"id": "r1", "text": "A blessing", "known": true, "itemId": "ent-sword"}]');
select t.is('VIS-1: a link''s note (relations), signed out', t.ent(t.v('after', 'W1 anon'), 'ent-quest')->'relations',
  '[{"id": "rel1", "to": "ent-tom", "kind": "ally", "known": true, "note": "Owes someone money"}]');
select t.is('VIS-1: relations for the player who knows', t.ent(t.v('after', 'W1 p1'), 'ent-quest')->'relations',
  '[{"id": "rel1", "to": "ent-tom", "kind": "ally", "known": true, "note": "Owes [[Duke Orlov|someone]] money"}, {"id": "rel2", "to": "ent-duke", "kind": "enemy", "known": true, "note": "x"}]');
select t.is('VIS-1: reputation notes', t.ent(t.v('after', 'W1 anon'), 'rep-party-10000000-0000-4000-8000-000000000001', 'reputation')->'notes',
  '[{"id": "n1", "known": true, "place": "[[Brindle Inn]]", "text": "Liked by the duke", "entityId": "ent-inn"}]');
select t.is('VIS-1: reputation reasons', t.ent(t.v('after', 'W1 anon'), 'rep-party-10000000-0000-4000-8000-000000000001', 'reputation')->'history'->0->>'reason',
  'Saved [[Old Tom|the innkeeper]] from a nun');
select t.is('VIS-1: a text handout', (select h->>'text' from jsonb_array_elements(t.v('after', 'W1 p2')->'world'->'handouts') h where h->>'id' = 'h2'),
  'Read this: him and [[Old Tom|Tom]].');
select t.is('VIS-1: a text handout for the player who knows', (select h->>'text' from jsonb_array_elements(t.v('after', 'W1 p1')->'world'->'handouts') h where h->>'id' = 'h2'),
  'Read this: [[Duke Orlov|him]] and [[Old Tom|Tom]].');
select t.is('VIS-1: random-table lines', t.ent(t.v('after', 'W1 p1'), 'ent-table')->'entries', '["A goblin", "3x Two goblins", "[[Duke Orlov|the duke]] was seen"]');
select t.is('VIS-1: the link pass on its own', public.player_links('a [[Duke Orlov|hooded stranger]] b [[Inn]] c [[ inn |the inn]] [[x|y|z]] [[bad|]] [[[Foo]] end', array['inn']),
  'a hooded stranger b [[Inn]] c [[ inn |the inn]] y|z [[bad|]] [[[Foo]] end');
select t.is('VIS-1: links next to each other', public.player_links('[[A|b]][[C|d]]', array['c']), 'b[[C|d]]');
select t.is('VIS-1: a link over two lines', public.player_links(E'x [[Secret\nName|lab\nel]] y', '{}'), E'x lab\nel y');
select t.check('VIS-1: text without links is left alone', public.player_links('plain', '{}') = 'plain' and public.player_links(null, '{}') is null);

-- ============ 2. VIS-3: only the ages that hold an event the viewer gets ============

select t.is('VIS-3: ages (' || label || ')', (select jsonb_agg(a->>'id') from jsonb_array_elements(t.v('after', label)->'world'->'ages') a),
  case when label like '%p2' then '["age-visible", "age-revealed"]' else '["age-visible"]' end::jsonb)
from t.views where world = 'W1';
select t.check('VIS-3: the ages that go out are unchanged (' || label || ')',
  coalesce(t.v('before', label)->'world'->'ages', '[]') @> coalesce(t.v('after', label)->'world'->'ages', '[]'))
from t.views;
select t.check('VIS-3: an age''s name and summary go nowhere without its events (' || label || ')',
  not t.has(t.v('after', label), 'Hidden Reign') and not t.has(t.v('after', label), 'secretly been the lich') and not t.has(t.v('after', label), 'Age of Ambushes'))
from t.views where world = 'W1';
-- In the example world, an age goes out exactly when the viewer gets a (non-campaign) event in it.
select t.check('VIS-3: each age goes out exactly when it holds an event the viewer gets (' || label || ')',
  not exists (
    select 1 from jsonb_array_elements(coalesce(t.v('before', label)->'world'->'ages', '[]')) a
    where (coalesce(t.v('after', label)->'world'->'ages', '[]') @> jsonb_build_array(a)) <> exists (
      select 1 from jsonb_array_elements(t.v('after', label)->'entities') e
      where e->>'type' = 'event' and coalesce(e->>'eventEra', '') <> 'campaign' and e->>'eventAge' = a->>'id')))
from t.views;
select t.check('VIS-3: a world with no ages still has no "ages"', not (public.player_view('30000000-0000-4000-8000-000000000003', null)->'world' ? 'ages'));

-- ============ 3. VIS-9: files keep their own id, with a plain name and no tags ============

select t.check('VIS-9: the same files go out as before (' || label || ')', t.ids(t.v('before', label), 'assets') = t.ids(t.v('after', label), 'assets'))
from t.views;
select t.check('VIS-9: each file has only its plain name, no tags and no other fields (' || label || ')',
  not exists (select 1 from jsonb_array_elements(t.v('after', label)->'assets') a
    where a->>'name' not in ('Picture', 'Sound', 'Video', 'File') or a->'tags' <> '[]'::jsonb
      or exists (select 1 from jsonb_object_keys(a) k where k not in ('id', 'worldId', 'name', 'mime', 'size', 'tags', 'visibility', 'createdAt', 'updatedAt'))))
from t.views;
select t.check('VIS-9: no file name or tag of the GM''s reaches anyone (' || label || ')',
  not t.has(t.v('after', label), 'duke-orlov-is-the-lich') and not t.has(t.v('after', label), 'masked-lich-portrait')
  and not t.has(t.v('after', label), 'letter-from-the-duke') and not t.has(t.v('after', label), 'realm-cover'))
from t.views where world = 'W1';
select t.is('VIS-9: files a signed-out reader gets', to_jsonb(t.ids(t.v('after', 'W1 anon'), 'assets')),
  '["a1000000-0000-4000-8000-000000000001", "a1000000-0000-4000-8000-000000000002", "a1000000-0000-4000-8000-000000000003", "a1000000-0000-4000-8000-000000000005", "a1000000-0000-4000-8000-000000000007", "a1000000-0000-4000-8000-000000000009", "a1000000-0000-4000-8000-00000000000b", "a1000000-0000-4000-8000-00000000000c", "a1000000-0000-4000-8000-00000000000e"]');
select t.is('VIS-9: a picture', t.ent(t.v('after', 'W1 anon'), 'a1000000-0000-4000-8000-000000000001', 'assets'),
  '{"id": "a1000000-0000-4000-8000-000000000001", "worldId": "10000000-0000-4000-8000-000000000001", "name": "Picture", "mime": "image/png", "size": 101, "tags": [], "visibility": "gm", "createdAt": 1700000000000, "updatedAt": 1700000000100}');
select t.is('VIS-9: a file with no type', t.ent(t.v('after', 'W1 anon'), 'a1000000-0000-4000-8000-00000000000c', 'assets'),
  '{"id": "a1000000-0000-4000-8000-00000000000c", "worldId": "10000000-0000-4000-8000-000000000001", "name": "File", "size": 112, "tags": [], "visibility": "players", "createdAt": 1700000000000}');
select t.is('VIS-9: names by type', (select jsonb_object_agg(a->>'id', a->>'name') from jsonb_array_elements(t.v('after', 'W1 p1')->'assets') a
    where a->>'id' in ('a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-000000000008')),
  '{"a1000000-0000-4000-8000-000000000009": "Sound", "a1000000-0000-4000-8000-00000000000b": "File", "a1000000-0000-4000-8000-00000000000e": "Video", "a1000000-0000-4000-8000-000000000008": "Picture"}');
select t.is('VIS-9: when a file was last changed still goes out (the app re-downloads changed files)',
  t.ent(t.v('after', 'W1 p1'), 'a1000000-0000-4000-8000-00000000000b', 'assets')->'updatedAt', '123');
select t.check('VIS-9: GM-only pictures nobody was sent stay unsent (clean map, GM map copy, a picture only in a write-up, a recording)',
  not exists (select 1 from t.views v, jsonb_array_elements(t.v('after', v.label)->'assets') a
    where v.world = 'W1' and a->>'id' in ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-00000000000d', 'a1000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000f')));
-- A row whose id inside doesn't match its own (only possible from before the FILE-2 check) still goes
-- out under the id it's stored as, which is what the shared-asset function builds the path from.
select t.is('VIS-9: a file goes out under its own row''s id, whatever it says inside',
  t.after_change('alter table public.records disable trigger records_check_ids',
    $$t.after_change($c$update public.records set data = data || '{"id": "../30000000-0000-4000-8000-000000000003/x"}' where table_name = 'assets' and id = 'a1000000-0000-4000-8000-000000000009'$c$,
      $e$(select jsonb_agg(a->>'id') from jsonb_array_elements(public.player_view('10000000-0000-4000-8000-000000000001', null)->'assets') a where a->>'id' like '%000000000009' or a->>'id' like '%/x')$e$)$$),
  '["a1000000-0000-4000-8000-000000000009"]');

-- ============ 4. SHOW-1: a picture being shown goes out only when the viewer gets that picture ============

select t.is('SHOW-1: a fogged map''s clean picture isn''t named (' || label || ')', t.v('after', label)->'world'->'showing', 'null')
from t.views where world = 'W1';
select t.is('SHOW-1: a picture players get still shows',
  t.after_change($$update public.records set data = data || '{"showing": {"id": "s9", "kind": "image", "title": "Letter", "assetId": "a1000000-0000-4000-8000-000000000008", "at": 9}}' where table_name = 'worlds' and id = '10000000-0000-4000-8000-000000000001'$$,
    $$public.player_view('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2')->'world'->'showing'->>'assetId'$$),
  '"a1000000-0000-4000-8000-000000000008"');
select t.is('SHOW-1: a map''s GM copy isn''t named',
  t.after_change($$update public.records set data = data || '{"showing": {"id": "s9", "kind": "image", "assetId": "a1000000-0000-4000-8000-000000000006", "at": 9}}' where table_name = 'worlds' and id = '10000000-0000-4000-8000-000000000001'$$,
    $$public.player_view('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2')->'world'->'showing'$$),
  'null');
select t.is('SHOW-1: shown text loses secret passages and hidden pages'' names',
  t.after_change($$update public.records set data = data || jsonb_build_object('showing', jsonb_build_object('id', 's9', 'kind', 'text', 'title', 'Note', 'text', E'See [[Duke Orlov|him]]\n:::gm\nsecret\n:::\nbye', 'at', 9)) where table_name = 'worlds' and id = '10000000-0000-4000-8000-000000000001'$$,
    $$public.player_view('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2')->'world'->'showing'->>'text'$$),
  to_jsonb(E'See him\nbye'::text));
select t.is('SHOW-1: a page shown goes out only to those who get the page',
  t.after_change($$update public.records set data = data || '{"showing": {"id": "s9", "kind": "page", "entityId": "ent-duke", "at": 9}}' where table_name = 'worlds' and id = '10000000-0000-4000-8000-000000000001'$$,
    $$jsonb_build_array(public.player_view('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1')->'world'->'showing'->>'entityId',
                        public.player_view('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2')->'world'->'showing')$$),
  '["ent-duke", null]');

-- ============ 5. VIS-6: random-table "#" notes, whatever space comes before the # ============

select t.is('VIS-6: random-table lines (' || label || ')', t.ent(t.v('after', label), 'ent-table')->'entries',
  case when duke_hidden then '["A goblin", "3x Two goblins", "the duke was seen"]' else '["A goblin", "3x Two goblins", "[[Duke Orlov|the duke]] was seen"]' end::jsonb)
from t.views where world = 'W1';
select t.is('VIS-6: trimmed like the app''s trim()', public.app_trim(chr(65279) || chr(160) || chr(9) || ' x ' || chr(12288) || chr(8195) || chr(8232)), 'x');

-- ============ 6. VIS-4: "\r\n", "\r" and "\n" all end a line ============

select t.is('VIS-4: the finding''s example (CR CR LF after a closing :::)', t.ent(t.v('after', 'W1 anon'), 'ent-crlf')->>'body', E'a\n\nSECRET2\n:::\nb');
select t.is('VIS-4: Windows line breaks', t.ent(t.v('after', 'W1 anon'), 'ent-crlf2')->>'body', E'shown\nline two');
select t.is('VIS-4: a lone carriage return ends a line', t.ent(t.v('after', 'W1 anon'), 'ent-crlf3')->>'body', E'a\nAFTER\n:::\nb\nc');
select t.is('VIS-4: a lone carriage return before an opener', public.player_text(E'x\r:::gm\nSECRET\n:::\ny', '{}'), E'x\ny');
select t.check('VIS-4: text reads the same with any kind of line break (' || left(replace(s, E'\n', '/'), 40) || ')',
  public.player_text(replace(s, E'\n', E'\r\n'), n) = public.player_text(s, n) and public.player_text(replace(s, E'\n', E'\r'), n) = public.player_text(s, n),
  public.player_text(s, n))
from (values
  (E'a\n:::gm\nSECRET1\n:::\nb', '{}'::text[]),
  (E':::gm\nA\n:::for Wren\nB\n:::\nC\n:::\nD', array['wren']),
  (E':::for Wren\nW\n:::\n:::for Bob\nX\n:::\ntail', array['wren']),
  (E'one\n  :::  GM  \nhidden\n  :::  \ntwo', '{}'),
  (E':::for Wren\nnever closed', array['wren'])
) v(s, n);

-- ============ 7. VIS-5: nobody can forge an "only you know" passage ============

select t.is('VIS-5: a forged line in a write-up, for another player', t.ent(t.v('after', 'W1 p2'), 'ent-wren')->>'playerBody',
  E'My notes about my enemy.\n![](asset:a1000000-0000-4000-8000-00000000000d)\nend');
select t.is('VIS-5: the same write-up for its own player', t.ent(t.v('after', 'W1 p1'), 'ent-wren')->>'playerBody',
  E'My notes about [[Duke Orlov|my enemy]].\n![](asset:a1000000-0000-4000-8000-00000000000d)\nend');
select t.is('VIS-5: a one-line :::foryou', public.player_text(':::foryouForged:::', '{}'), '');
select t.is('VIS-5: a :::foryou block', public.player_text(E'x\n:::foryou\nhidden\n:::\ny', '{}'), E'x\ny');
select t.is('VIS-5: spaces and capitals', public.player_text(E'x\n  :::  FORYOU text:::\ny', '{}'), E'x\ny');
select t.is('VIS-5: :::foryou with more after it', public.player_text(E'x\n:::foryou: also\nhidden\n:::\ny', '{}'), E'x\ny');
select t.is('VIS-5: not at the start of a line, it''s just text (as in the app)', public.player_text('Wren: :::foryouYour patron orders you.:::', '{}'),
  'Wren: :::foryouYour patron orders you.:::');
select t.is(':::for: a passage for the viewer''s character still arrives', t.ent(t.v('after', 'W1 p1'), 'ent-wren')->>'body',
  E':::foryou\nWren knows [[Duke Orlov|the duke]] is a lich.\n:::\nA ranger from the north.');
select t.is(':::for: and not for anyone else', t.ent(t.v('after', 'W1 p2'), 'ent-wren')->>'body', 'A ranger from the north.');
select t.is(':::for: Bob''s', t.ent(t.v('after', 'W1 p2'), 'ent-silas')->>'body', E':::foryou\nSilas has a secret.\n:::\nA thief.');
select t.is(':::for: not until the GM approves the character', t.ent(t.v('after', 'W1 p3'), 'ent-wren')->>'body', 'A ranger from the north.');
select t.is(':::for: one line (sent as a block, as before)', public.player_text(':::for Wren::: one line :::', array['wren']), E':::foryou\none line\n:::');

-- ============ 8. Nothing else changes ============

-- Every difference between before and after, with the fix that explains it (null: none does).
create function t.why(label text, path text, b jsonb, a jsonb) returns text language plpgsql stable as $$
declare
  view jsonb := t.v('after', label);
  pages text[] := t.page_names(view);
begin
  if path ~ '^\$\.assets\[[^]]+\]\.name$' and a #>> '{}' in ('Picture', 'Sound', 'Video', 'File') then
    return 'VIS-9 file name';
  end if;
  if path ~ '^\$\.assets\[[^]]+\]\.tags$' and a = '[]'::jsonb then
    return 'VIS-9 file tags';
  end if;
  if (path ~ '^\$\.world\.ages\[[^]]+\]$' and a is null and b is not null)
     or (path = '$.world.ages' and jsonb_typeof(a) = 'array' and b @> a) then
    return 'VIS-3 age left out';
  end if;
  if path = '$.world.showing' and a = 'null'::jsonb and b->>'kind' = 'image'
     and not exists (select 1 from jsonb_array_elements(view->'assets') x where x->>'id' = b->>'assetId') then
    return 'SHOW-1';
  end if;
  if jsonb_typeof(a) = 'string' and jsonb_typeof(b) = 'string' and a #>> '{}' = public.player_links(b #>> '{}', pages) then
    return 'VIS-1 link';
  end if;
  if path ~ '\.entries$' and jsonb_typeof(a) = 'array' and jsonb_typeof(b) = 'array' and a = coalesce((
      select jsonb_agg(public.player_links(x, pages) order by k) from jsonb_array_elements_text(b) with ordinality as l(x, k)
      where public.app_trim(x) not like '#%' and public.app_trim(x) <> ''), '[]'::jsonb) then
    return 'VIS-6 table line';
  end if;
  -- Test Realm's line-break and forgery pages, checked word for word above.
  if label like 'W1 %' and path ~ '^\$\.entities\[(ent-crlf|ent-crlf3)\]\.body$' then
    return 'VIS-4 line breaks';
  end if;
  if label like 'W1 %' and path = '$.entities[ent-wren].playerBody' then
    return 'VIS-5 forged passage';
  end if;
  return null;
end $$;

create table t.diffs as
select s.label, d.path, d.before, d.after, t.why(s.label, d.path, d.before, d.after) as why
from t.snap s cross join lateral t.jdiff(s.view, t.v('after', s.label)) d
where s.phase = 'before' and s.label not in ('functions', 'table rights');

select t.check('nothing changes but the fixes (' || l.label || ')',
  not exists (select 1 from t.diffs d where d.label = l.label and d.why is null),
  coalesce((select string_agg(d.path || ': ' || left(coalesce(d.before::text, 'none'), 300) || ' -> ' || left(coalesce(d.after::text, 'none'), 300), E'\n')
    from t.diffs d where d.label = l.label and d.why is null), ''))
from (select label from t.snap where phase = 'before' and label not in ('functions', 'table rights')) l;
select t.check('the same pages, maps, pins, sessions, campaigns and reputation go out (' || v.label || ')',
  not exists (select 1 from unnest(array['entities', 'maps', 'pins', 'sessions', 'campaigns', 'reputation']) p
    where t.ids(t.v('before', v.label), p) <> t.ids(t.v('after', v.label), p)))
from t.views v;
select t.check('the example world is all there (' || label || ')', jsonb_array_length(t.v('after', label)->'entities') > 50)
from t.views where world = 'VA' and exists (select 1 from public.records where world_id = '20000000-0000-4000-8000-000000000002' and table_name = 'entities');
select t.check('running the migration again changes nothing (' || a.label || ')', a.view is not distinct from t.v('again', a.label))
from t.snap a where a.phase = 'after';
select t.check('functions keep their arguments, rights, owner and settings', t.v('before', 'functions') = t.v('after', 'functions'),
  coalesce((select string_agg(path || ': ' || coalesce(before::text, 'none') || ' -> ' || coalesce(after::text, 'none'), E'\n') from t.jdiff(t.v('before', 'functions'), t.v('after', 'functions'))), ''));
select t.check('the new helpers can''t be called by signed-in or signed-out callers',
  not has_function_privilege('anon', 'public.player_links(text, text[])', 'execute')
  and not has_function_privilege('authenticated', 'public.player_links(text, text[])', 'execute')
  and not has_function_privilege('authenticated', 'public.app_trim(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.records_check_ids()', 'execute'));
select t.is('member_name_ok still works when called directly', t.ask('public.member_name_ok(''Sam'')', t.who('bob')), 'true');

-- ============ 9. FILE-2: a synced row's id and world are the ones inside it ============

select t.check('FILE-2: every row already saved passes (' || (select count(*) from public.records where data is not null) || ' rows)', r is null, r)
from t.err($$update public.records set data = data where data is not null$$) r;
select t.check('FILE-2: the check is on, once', (select count(*) from pg_trigger where tgrelid = 'public.records'::regclass and tgname = 'records_check_ids') = 1);
select t.check('FILE-2: the GM''s app can save a new page', r is null, r) from t.fails($$
  insert into public.records (world_id, table_name, id, data, deleted)
  values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-new', '{"id": "ent-new", "worldId": "10000000-0000-4000-8000-000000000001", "type": "npc", "name": "New", "visibility": "gm"}', false)
  on conflict (table_name, id) do update set world_id = excluded.world_id, data = excluded.data, deleted = excluded.deleted$$, t.who('gm')) r;
select t.check('FILE-2: the co-GM''s app can change a page', r is null, r) from t.fails($$
  insert into public.records (world_id, table_name, id, data, deleted)
  select world_id, table_name, id, data || '{"name": "Brindle Inn (rebuilt)"}', false from public.records where table_name = 'entities' and id = 'ent-inn'
  on conflict (table_name, id) do update set world_id = excluded.world_id, data = excluded.data, deleted = excluded.deleted$$, t.who('cogm')) r;
select t.check('FILE-2: the world''s own row saves', r is null, r) from t.fails($$
  insert into public.records (world_id, table_name, id, data)
  select world_id, table_name, id, data || '{"name": "Test Realm 2"}' from public.records where table_name = 'worlds' and id = '10000000-0000-4000-8000-000000000001'
  on conflict (table_name, id) do update set data = excluded.data$$, t.who('gm')) r;
select t.check('FILE-2: a file''s row saves', r is null, r) from t.fails($$
  insert into public.records (world_id, table_name, id, data)
  values ('10000000-0000-4000-8000-000000000001', 'assets', 'a1000000-0000-4000-8000-000000000010', '{"id": "a1000000-0000-4000-8000-000000000010", "worldId": "10000000-0000-4000-8000-000000000001", "name": "new.png", "mime": "image/png", "size": 5, "tags": [], "visibility": "gm", "createdAt": 1}')
  on conflict (table_name, id) do update set data = excluded.data$$, t.who('gm')) r;
select t.check('FILE-2: deleting (a row with no data) still works', r is null, r) from t.fails($$
  insert into public.records (world_id, table_name, id, data, deleted)
  values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-sword', null, true)
  on conflict (table_name, id) do update set world_id = excluded.world_id, data = excluded.data, deleted = excluded.deleted$$, t.who('gm')) r;
select t.check('FILE-2: a player can still edit their character', r is null, r) from t.fails($$
  select public.edit_my_character('10000000-0000-4000-8000-000000000001', 'ent-wren', 'A ranger', '[{"key": "Class", "value": "Ranger"}]', 'My notes.')$$, t.who('alice')) r;
select t.check('FILE-2: refused: ' || what, r like '23514:%', coalesce(r, '(went through)')) from (values
  ('a different id inside', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '{"id": "ent-y", "worldId": "10000000-0000-4000-8000-000000000001"}')$$, 'gm'),
  ('another world inside', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '{"id": "ent-x", "worldId": "30000000-0000-4000-8000-000000000003"}')$$, 'gm'),
  ('no world inside', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '{"id": "ent-x"}')$$, 'gm'),
  ('no id inside', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '{"worldId": "10000000-0000-4000-8000-000000000001"}')$$, 'gm'),
  ('not an object', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '"text"')$$, 'gm'),
  ('a world row filed under another world', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'worlds', '30000000-0000-4000-8000-0000000000ff', '{"id": "30000000-0000-4000-8000-0000000000ff"}')$$, 'gm'),
  ('a co-GM''s world row that says it''s another world (the finding)', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'worlds', 'evil-world', '{"id": "30000000-0000-4000-8000-000000000003", "name": "Hijacked"}')$$, 'cogm'),
  ('a co-GM''s page that says it''s another world''s (the finding)', $$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'evil-page', '{"id": "other-page", "worldId": "30000000-0000-4000-8000-000000000003", "visibility": "players", "name": "Injected"}')$$, 'cogm'),
  ('changing the id inside a saved row', $$update public.records set data = data || '{"id": "ent-tom"}' where table_name = 'entities' and id = 'ent-inn'$$, 'gm')
) v(what, sql, who), t.fails(sql, t.who(who)) r;
select t.check('FILE-2: the check runs for callers who can''t call it themselves',
  not has_function_privilege('authenticated', 'public.records_check_ids()', 'execute')
  and t.fails($$insert into public.records (world_id, table_name, id, data) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-x', '{"id": "ent-y", "worldId": "10000000-0000-4000-8000-000000000001"}')$$, t.who('gm')) like '23514:%');

-- ============ 10. NAME-1: names that can't pass for someone else ============

select t.check('NAME-1: a fine name: ' || to_jsonb(n)::text, public.member_name_ok(n)) from (values
  ('Sam'), ('Zo' || chr(235)), ('Mary-Jane O''Neil'), (chr(129497) || chr(8205) || chr(9794) || chr(65039) || ' Merlin'),
  (chr(1605) || chr(1740) || chr(8204) || chr(1582) || chr(1608) || chr(1575) || chr(1607) || chr(1605)), (chr(65319) || chr(65325)), ('Dana 2')) v(n);
select t.check('NAME-1: refused: ' || what, not public.member_name_ok(n)) from (values
  ('a joiner between letters', 'G' || chr(8205) || 'M'), ('right-to-left override', chr(8238) || 'evil'), ('a bell character', 'Bob' || chr(7)),
  ('a zero-width space', 'G' || chr(8203) || 'M'), ('only a no-break space', chr(160)), ('only a variation selector', chr(65039)),
  ('a Hangul filler', chr(12644)), ('a soft hyphen', 'Al' || chr(173) || 'ice'), ('a left-to-right mark', 'Bob' || chr(8206)),
  ('a direction isolate', 'x' || chr(8294) || 'y'), ('a link', 'www.example.com'), ('an invite link', 'https://x.test/join/abc'), ('nothing', '')) v(what, n);
select t.check('NAME-1: these count as the same name as "Alice": ' || to_jsonb(n)::text, public.member_name_key(n) = 'alice') from (values
  ('ALICE'), (' alice '), (chr(65313) || chr(65356) || chr(65353) || chr(65347) || chr(65349)), ('Al' || chr(8204) || 'ice'), ('Alice' || chr(160))) v(n);
select t.check('NAME-1 rename: ' || what, case when expect is null then r is null else strpos(coalesce(r, ''), expect) > 0 end, coalesce(r, '(went through)'))
from (values
  ('a player can''t take another player''s name', 'bob', 'alice', 'already goes by that name'),
  ('or one written in other letters', 'bob', chr(65313) || chr(65324) || chr(65321) || chr(65315) || chr(65317), 'already goes by that name'),
  ('or the co-GM''s', 'bob', 'dana', 'already goes by that name'),
  ('a hidden character is explained', 'bob', 'Bo' || chr(8203) || 'b', 'hidden or unusual character'),
  ('so is a right-to-left one', 'bob', chr(8238) || 'boB', 'hidden or unusual character'),
  ('a link is still refused', 'bob', 'https://evil.test', 'not a link'),
  ('a player can keep their own name', 'bob', 'Bob', null),
  ('or change its capitals', 'bob', 'BOB', null),
  ('or take a new one', 'bob', 'Bobby', null)
) v(what, who, n, expect), t.fails(format('select public.rename_member(%L, %L, %L)', '10000000-0000-4000-8000-000000000001', t.who(who), n), t.who(who)) r;
select t.check('NAME-1 rename by the GM: ' || what, case when expect is null then r is null else strpos(coalesce(r, ''), expect) > 0 end, coalesce(r, '(went through)'))
from (values ('the GM can''t give a player someone else''s name', 'Cara', 'already goes by that name'), ('but can rename them', 'Robert', null)) v(what, n, expect),
  t.fails(format('select public.rename_member(%L, %L, %L)', '10000000-0000-4000-8000-000000000001', t.who('bob'), n), t.who('gm')) r;
select t.check('NAME-1 join: a newcomer can''t take a name someone has', strpos(coalesce(r->>'error', ''), 'already goes by that name') > 0, coalesce(r::text, '(went through)'))
from t.ask($$public.join_world('w1-invite-token-0123456789abcdef', 'alice')$$, t.who('dave')) r;
select t.is('NAME-1 join: and isn''t let in with it', (select count(*) from public.world_members where user_id = t.who('dave'))::text, '0');
select t.is('NAME-1 join: a member opening the invite again with their own name is fine',
  t.ask($$public.join_world('w1-invite-token-0123456789abcdef', 'Bob')$$, t.who('bob'), false), '"10000000-0000-4000-8000-000000000001"');
select t.is('NAME-1 join: a name with a hidden character is left blank, as a link always was',
  t.after_change($$select t.run('select public.join_world(''w1-invite-token-0123456789abcdef'', ''Da' || chr(8238) || 've'')', t.who('dave'))$$,
    $$(select display_name from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = t.who('dave'))$$),
  '""');

-- ============ 11. Co-GM links work once (4a); player invites keep working ============

-- (Each change is one statement of t.run calls, which run one after another, so the expression after
-- it sees all they did.)
select t.is('4a: joining with a co-GM link makes you a co-GM and turns the link off',
  t.after_change($$select t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Erin'')', t.who('erin')),
      t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Finn'')', t.who('finn'))$$,
    $$jsonb_build_object(
      'role', (select role from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = t.who('erin')),
      'links', (select count(*) from public.gm_invites where world_id = '10000000-0000-4000-8000-000000000001'),
      'next person joined', (select count(*) from public.world_members where user_id = t.who('finn')))$$),
  '{"role": "gm", "links": 0, "next person joined": 0}');
select t.is('4a: a used co-GM link opens nothing',
  t.after_change($$delete from public.gm_invites$$, $$t.ask($q$public.join_world('w1-cogm-token-0123456789abcdef', 'Finn')$q$, t.who('finn'))$$),
  null::jsonb);
select t.is('4a: a player who opens it becomes a co-GM, and the link is used up',
  t.after_change($$select t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Cara'')', t.who('cara'))$$,
    $$jsonb_build_object(
      'role', (select role from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = t.who('cara')),
      'links', (select count(*) from public.gm_invites where world_id = '10000000-0000-4000-8000-000000000001'))$$),
  '{"role": "gm", "links": 0}');
select t.is('4a: the owner opening it changes nothing',
  t.after_change($$select t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Boss'')', t.who('gm'))$$,
    $$jsonb_build_object(
      'links', (select count(*) from public.gm_invites where world_id = '10000000-0000-4000-8000-000000000001'),
      'owner listed', (select count(*) from public.world_members where user_id = t.who('gm')))$$),
  '{"links": 1, "owner listed": 0}');
select t.is('4a: a co-GM opening it changes nothing',
  t.after_change($$select t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Someone'')', t.who('cogm'))$$,
    $$jsonb_build_object(
      'links', (select count(*) from public.gm_invites where world_id = '10000000-0000-4000-8000-000000000001'),
      'name', (select display_name from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = t.who('cogm')))$$),
  '{"links": 1, "name": "Dana"}');
select t.is('4a: a name taken at the table keeps the link for the next try',
  t.after_change($$select t.run('select public.join_world(''w1-cogm-token-0123456789abcdef'', ''Alice'')', t.who('erin'))$$,
    $$(select count(*) from public.gm_invites where world_id = '10000000-0000-4000-8000-000000000001')$$),
  '1');
select t.is('4a: one player invite lets several people in, and stays the same',
  t.after_change($$select t.run('select public.join_world(''w1-invite-token-0123456789abcdef'', ''Erin''), public.join_world(''w1-invite-token-0123456789abcdef'', ''Erin'')', t.who('erin')),
      t.run('select public.join_world(''w1-invite-token-0123456789abcdef'', ''Finn'')', t.who('finn'))$$,
    $$jsonb_build_object(
      'players', (select jsonb_agg(display_name order by display_name) from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and role = 'player'),
      'invite', (select invite_token from public.cloud_worlds where id = '10000000-0000-4000-8000-000000000001'))$$),
  '{"players": ["Alice", "Bob", "Cara", "Erin", "Finn"], "invite": "w1-invite-token-0123456789abcdef"}');
select t.check('4a: the GM can make a new co-GM link', r is null, r) from t.fails($$
  insert into public.gm_invites (world_id, token) values ('10000000-0000-4000-8000-000000000001', 'w1-new-cogm-token-0123456789abcdef')
  on conflict (world_id) do update set token = excluded.token$$, t.who('gm')) r;

-- ============ 12. MEM-1: people join only with a link ============

select t.check('MEM-1 refused: ' || what, r like '42501:%', coalesce(r, '(went through)')) from (values
  ('the owner adding a player', $$insert into public.world_members (world_id, user_id, role, display_name) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c4', 'player', 'Finn')$$),
  ('the owner adding a co-GM', $$insert into public.world_members (world_id, user_id, role, display_name) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c4', 'gm', 'Finn')$$),
  ('the owner swapping one person for another', $$update public.world_members set user_id = '00000000-0000-4000-8000-0000000000c4' where world_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-0000000000b3'$$),
  ('the owner making a player a co-GM', $$update public.world_members set role = 'gm' where world_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-0000000000b3'$$)
) v(what, sql), t.fails(sql, t.who('gm')) r;
select t.is('MEM-1: the owner still sees everyone', t.ask($$(select count(*) from public.world_members where world_id = '10000000-0000-4000-8000-000000000001')$$, t.who('gm')), '4');
select t.is('MEM-1: the owner can still remove a player',
  t.ask($$with gone as (delete from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-0000000000b3' returning 1) select to_jsonb(count(*)) from gone$$, t.who('gm'), false), '1');
select t.is('MEM-1: a player can still leave',
  t.ask($$with gone as (delete from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-0000000000b2' returning 1) select to_jsonb(count(*)) from gone$$, t.who('bob'), false), '1');
select t.is('MEM-1: and nobody else can remove them',
  t.ask($$with gone as (delete from public.world_members where world_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-0000000000b2' returning 1) select to_jsonb(count(*)) from gone$$, t.who('alice'), false), '0');

-- ============ 13. PRIV-10: no TRUNCATE, REFERENCES or TRIGGER for callers ============

select t.check('PRIV-10: anon and authenticated can''t truncate, reference or add triggers to ' || c.relname,
  not exists (select 1 from unnest(array['anon', 'authenticated']) r, unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p where has_table_privilege(r, c.oid, p)))
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r';
with b as (select key as tbl, x.grantee, x.privilege_type from jsonb_each_text(t.v('before', 'table rights')) e, aclexplode(e.value::aclitem[]) x),
     a as (select key as tbl, x.grantee, x.privilege_type from jsonb_each_text(t.v('after', 'table rights')) e, aclexplode(e.value::aclitem[]) x),
     gone as (select * from b except select * from a),
     added as (select * from a except select * from b)
select t.check('PRIV-10: only those rights were taken away, and nothing was given',
  not exists (select 1 from added)
  and not exists (select 1 from gone where grantee not in ('anon'::regrole, 'authenticated'::regrole) or privilege_type not in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'))
  and exists (select 1 from gone),
  (select count(*) from gone) || ' taken away; given: ' || coalesce((select string_agg(tbl || ' ' || privilege_type, ', ') from added), 'none'));
select t.is('PRIV-10: a table added later doesn''t give them either (but still gives what row security needs)',
  t.after_change('create table public.zz_rights_check (id int)',
    $$jsonb_build_object(
      'extra', (select count(*) from aclexplode((select relacl from pg_class where oid = 'public.zz_rights_check'::regclass)) x
                where x.grantee in ('anon'::regrole, 'authenticated'::regrole) and x.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')),
      'select', has_table_privilege('authenticated', 'public.zz_rights_check', 'SELECT'))$$),
  '{"extra": 0, "select": true}');
select t.check('PRIV-10: truncating as a signed-in caller is refused', r like '42501:%', coalesce(r, '(went through)'))
from t.fails('truncate public.ai_keys', t.who('alice')) r;

-- ============ 14. FILE-7: at most 50 MB a file ============

select t.is('FILE-7: the assets bucket takes files up to 50 MB', (select file_size_limit from storage.buckets where id = 'assets')::text, '52428800');

-- ============ 15. MAPPACK-1: one odd file name can't break other people's pack listings ============

select t.check('MAPPACK-1: a pack picture still uploads', r is null, r) from t.run($$
  insert into storage.objects (bucket_id, name, owner) values ('map-packs', '00000000-0000-4000-8000-0000000000b1/a2000000-0000-4000-8000-000000000001/1-1-full.webp', '00000000-0000-4000-8000-0000000000b1')$$, t.who('alice')) r;
select t.check('MAPPACK-1 refused: ' || what, r like '42501:%', coalesce(r, '(went through)')) from (values
  ('a second folder that isn''t a piece id', $$insert into storage.objects (bucket_id, name, owner) values ('map-packs', '00000000-0000-4000-8000-0000000000b1/not-a-uuid/1-1-full.webp', '00000000-0000-4000-8000-0000000000b1')$$),
  ('no second folder', $$insert into storage.objects (bucket_id, name, owner) values ('map-packs', '00000000-0000-4000-8000-0000000000b1/x.webp', '00000000-0000-4000-8000-0000000000b1')$$),
  ('renaming into an odd folder', $$update storage.objects set name = '00000000-0000-4000-8000-0000000000b1/not-a-uuid/x.webp' where bucket_id = 'map-packs' and name like '00000000-0000-4000-8000-0000000000b1/%'$$),
  ('someone else''s folder', $$insert into storage.objects (bucket_id, name, owner) values ('map-packs', '00000000-0000-4000-8000-0000000000b2/a2000000-0000-4000-8000-000000000002/1-1-full.webp', '00000000-0000-4000-8000-0000000000b1')$$)
) v(what, sql), t.fails(sql, t.who('alice')) r;
-- A file put there some other way, with an odd second folder.
insert into storage.objects (bucket_id, name, owner) values ('map-packs', '00000000-0000-4000-8000-0000000000c1/not-a-uuid/x.webp', '00000000-0000-4000-8000-0000000000c1');
select t.is('MAPPACK-1: other people''s listings still work', t.ask($$(select count(*) from storage.objects where bucket_id = 'map-packs')$$, t.who('bob')), '0');
select t.is('MAPPACK-1: the owner still sees their own', t.ask($$(select count(*) from storage.objects where bucket_id = 'map-packs')$$, t.who('alice')), '1');
select t.check('MAPPACK-1: with the old rule, that odd file broke other people''s listings',
  t.after_change($$alter policy "pack owners and world gms read pack pictures" on storage.objects using (bucket_id = 'map-packs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.can_read_pack_piece(((storage.foldername(name))[2])::uuid)))$$,
    $$t.ask('(select count(*) from storage.objects where bucket_id = ''map-packs'')', t.who('bob'))$$)->>'error' like '22P02:%');

-- ============ 16. Players still join, rename, claim, edit and write notes ============

select t.is('players: a new player joins with the invite', t.ask($$public.join_world('w1-invite-token-0123456789abcdef', 'Dave')$$, t.who('dave')), '"10000000-0000-4000-8000-000000000001"');
select t.check('players: and renames themselves', r is null, r)
from t.run($$select public.rename_member('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c2', 'Davey')$$, t.who('dave')) r;
select t.check('players: and claims a character', r is null, r)
from t.run($$select public.claim_character('10000000-0000-4000-8000-000000000001', 'ent-kael')$$, t.who('dave')) r;
select t.check('players: the GM approves it', r is null, r)
from t.run($$update public.character_claims set approved = true where world_id = '10000000-0000-4000-8000-000000000001' and entity_id = 'ent-kael'$$, t.who('gm')) r;
select t.check('players: the player writes up their character', r is null, r)
from t.run($$select public.edit_my_character('10000000-0000-4000-8000-000000000001', 'ent-kael', 'A bard', '[{"key": "Class", "value": "Bard"}]', 'My story.')$$, t.who('dave')) r;
select t.is('players: and the write-up is saved (with the GM''s own detail kept)',
  (select jsonb_build_object('summary', data->'summary', 'playerBody', data->'playerBody', 'fields', data->'fields') from public.records where table_name = 'entities' and id = 'ent-kael'),
  '{"summary": "A bard", "playerBody": "My story.", "fields": [{"key": "Class", "value": "Bard"}, {"key": "GM secret", "value": "x", "gm": true}]}');
select t.check('players: notes on their character save', r is null, r)
from t.run($$select public.set_player_notes('10000000-0000-4000-8000-000000000001', 'ent-kael', 'my notes')$$, t.who('dave')) r;
select t.check('players: group notes save', r is null, r)
from t.run($$select public.save_player_note('10000000-0000-4000-8000-000000000001', 'ent-inn', true, 'Group note', null)$$, t.who('dave')) r;
select t.check('players: their own notes save', r is null, r)
from t.run($$select public.save_player_note('10000000-0000-4000-8000-000000000001', '', false, 'Only mine', null)$$, t.who('alice')) r;
select t.is('players: what the new player gets',
  (select jsonb_build_object(
      'me', w->'me',
      'name', (select m->'name' from jsonb_array_elements(w->'members') m where m->>'userId' = '00000000-0000-4000-8000-0000000000c2'),
      'claim', (select jsonb_build_object('notes', c->'notes', 'approved', c->'approved') from jsonb_array_elements(w->'claims') c where c->>'entityId' = 'ent-kael'),
      'kael', (select jsonb_build_object('playerBody', e->'playerBody', 'fields', e->'fields') from jsonb_array_elements(w->'entities') e where e->>'id' = 'ent-kael'),
      'group note', (select n->'body' from jsonb_array_elements(w->'notes') n where n->>'entityId' = 'ent-inn' and n->>'shared' = 'true'))
   from (select t.ask($$public.member_world('10000000-0000-4000-8000-000000000001')$$, t.who('dave')) w) x),
  '{"me": "00000000-0000-4000-8000-0000000000c2", "name": "Davey", "claim": {"notes": "my notes", "approved": true}, "kael": {"playerBody": "My story.", "fields": [{"key": "Class", "value": "Bard"}]}, "group note": "Group note"}');
select t.is('players: a stranger still gets nothing', t.ask($$public.member_world('10000000-0000-4000-8000-000000000001')$$, t.who('stranger')), null::jsonb);
select t.check('players: signed out, joining is refused', r like '42501:%', coalesce(r, '(went through)'))
from t.fails($$select public.join_world('w1-invite-token-0123456789abcdef', 'Ghost')$$, null) r;
