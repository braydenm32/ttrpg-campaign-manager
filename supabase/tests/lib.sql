-- Test helpers for security_audit.sql: a results list, saved views to compare, and a JSON diff.
-- Lives in its own schema "t", so nothing here touches the app's tables.
-- Some use public.app_trim, which only exists once the migration is in, so they're checked when used.
set check_function_bodies = off;
create schema t;
grant usage on schema t to anon, authenticated;

create table t.results (seq serial primary key, name text not null, ok boolean not null, detail text not null default '');
create table t.snap (phase text not null, label text not null, view jsonb, primary key (phase, label));
grant select, insert on t.results, t.snap to anon, authenticated;
grant usage on sequence t.results_seq_seq to anon, authenticated;

-- Notes one check. "detail" says what was seen, for when it fails.
create function t.check(name text, ok boolean, detail text default '') returns void language sql as $$
  insert into t.results (name, ok, detail) values (name, coalesce(ok, false), coalesce(detail, '(null)'))
$$;
grant execute on function t.check(text, boolean, text) to anon, authenticated;

-- A saved view, and one page (or other row with an id) in a view.
create function t.v(phase text, label text) returns jsonb language sql stable as $$
  select view from t.snap s where s.phase = v.phase and s.label = v.label
$$;
create function t.ent(view jsonb, id text, part text default 'entities') returns jsonb language sql immutable as $$
  select e from jsonb_array_elements(coalesce(view->part, '[]')) e where e->>'id' = ent.id
$$;
-- The ids in one part of a view, sorted.
create function t.ids(view jsonb, part text) returns text[] language sql immutable as $$
  select coalesce(array_agg(e->>'id' order by e->>'id'), '{}') from jsonb_array_elements(coalesce(view->part, '[]')) e
$$;

-- An array of objects that each have their own id (pages, sessions, files...), so two versions can be
-- lined up by id rather than by position.
create function t.by_id(a jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(a) = 'array' and jsonb_array_length(a) > 0
    and not exists (select 1 from jsonb_array_elements(a) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') <> 'string')
    and (select count(distinct e->>'id') from jsonb_array_elements(a) e) = jsonb_array_length(a)
$$;

-- Every place two JSON values differ: objects key by key, arrays of things with ids by id, other arrays
-- of the same length position by position. "path" is like $.entities[ent-inn].body.
create function t.jdiff(a jsonb, b jsonb, at text default '$') returns table (path text, before jsonb, after jsonb)
language plpgsql immutable as $$
declare
  k text;
  n integer;
begin
  if a is not distinct from b then
    return;
  end if;
  if jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
    for k in select x from (select jsonb_object_keys(a) as x union select jsonb_object_keys(b)) keys order by 1 loop
      return query select * from t.jdiff(a->k, b->k, at || '.' || k);
    end loop;
    return;
  end if;
  if t.by_id(a) and t.by_id(b) then
    for k in select x from (select e->>'id' as x from jsonb_array_elements(a) e union select e->>'id' from jsonb_array_elements(b) e) ids order by 1 loop
      return query select * from t.jdiff(
        (select e from jsonb_array_elements(a) e where e->>'id' = k),
        (select e from jsonb_array_elements(b) e where e->>'id' = k),
        at || '[' || k || ']');
    end loop;
    return;
  end if;
  if jsonb_typeof(a) = 'array' and jsonb_typeof(b) = 'array' and jsonb_array_length(a) = jsonb_array_length(b) then
    for n in 0 .. jsonb_array_length(a) - 1 loop
      return query select * from t.jdiff(a->n, b->n, at || '[' || n || ']');
    end loop;
    return;
  end if;
  path := at;
  before := a;
  after := b;
  return next;
end $$;

-- The names of the pages in a view, as player_view matches [[links]] against them.
create function t.page_names(view jsonb) returns text[] language sql immutable as $$
  select coalesce(array_agg(lower(public.app_trim(e->>'name'))), '{}') from jsonb_array_elements(coalesce(view->'entities', '[]')) e
$$;

-- Runs a statement as someone, the way the app's calls arrive: a user id (signed in), or null (signed
-- out, with only the public key). Gives back the error it raised, or null when it went through.
-- keep = false undoes what it did either way.
create function t.run(sql text, who uuid, keep boolean default true) returns text language plpgsql as $$
declare
  msg text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), true);
  execute format('set local role %I', case when who is null then 'anon' else 'authenticated' end);
  begin
    execute sql;
    if not keep then
      raise exception using errcode = 'P0099', message = '(went through)';
    end if;
  exception when others then
    msg := case when sqlstate = 'P0099' then null else sqlstate || ': ' || sqlerrm end;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return msg;
end $$;
create function t.fails(sql text, who uuid) returns text language sql as $$
  select t.run(sql, who, false)
$$;

-- The query that works out "expr": an expression, or a whole query (select or with) giving one jsonb.
create function t.q(expr text) returns text language sql immutable as $$
  select case when expr ~* '^\s*(with|select)\s' then expr else 'select to_jsonb((' || expr || '))' end
$$;

-- The value of an expression (see t.q) worked out as someone, or {"error": ...} if it failed.
create function t.ask(expr text, who uuid, keep boolean default true) returns jsonb language plpgsql as $$
declare
  answer jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(who::text, ''), true);
  execute format('set local role %I', case when who is null then 'anon' else 'authenticated' end);
  begin
    execute t.q(expr) into answer;
    if not keep then
      raise exception using errcode = 'P0099', message = '(went through)';
    end if;
  exception when others then
    if sqlstate <> 'P0099' then
      answer := jsonb_build_object('error', sqlstate || ': ' || sqlerrm);
    end if;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return answer;
end $$;

-- Runs a statement as the database owner and gives back its error, or null; undone either way.
create function t.err(sql text) returns text language plpgsql as $$
declare
  msg text;
begin
  begin
    execute sql;
    raise exception using errcode = 'P0099', message = '(went through)';
  exception when others then
    msg := case when sqlstate = 'P0099' then null else sqlstate || ': ' || sqlerrm end;
  end;
  return msg;
end $$;

-- The people in seed.sql, by name.
create function t.who(name text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || case name
    when 'gm' then 'a1' when 'cogm' then 'a2' when 'gm2' then 'a3'
    when 'alice' then 'b1' when 'bob' then 'b2' when 'cara' then 'b3' when 'vera' then 'b4' when 'quinn' then 'b5'
    when 'stranger' then 'c1' when 'dave' then 'c2' when 'erin' then 'c3' when 'finn' then 'c4' end)::uuid
$$;

-- Every piece of text in a view (not the keys).
create function t.strings(view jsonb) returns setof text language sql immutable as $$
  select s #>> '{}' from jsonb_path_query(coalesce(view, 'null'), 'strict $.** ? (@.type() == "string")') s
$$;

-- Labelled links in a view ("[[Page|label]]") whose page isn't one the viewer gets: what VIS-1 is about.
create function t.bad_links(view jsonb) returns setof text language sql immutable as $$
  select distinct m[1] from t.strings(view) s, regexp_matches(s, '\[\[([^]|]+)\|([^]]+)\]\]', 'g') m
  where lower(public.app_trim(m[1])) <> all(t.page_names(view))
$$;

-- Makes a change as the database owner, works out an expression, then undoes the change.
create function t.after_change(change text, expr text) returns jsonb language plpgsql as $$
declare
  answer jsonb;
begin
  begin
    execute change;
    execute t.q(expr) into answer;
    raise exception using errcode = 'P0099', message = '(undo)';
  exception when sqlstate 'P0099' then
    null;
  end;
  return answer;
end $$;

reset check_function_bodies;
