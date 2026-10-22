-- ":::for" passages: more ways to name several characters, and a one-line form.
--  - Names can be split by commas, "&" or "and": ":::for Wren, Silas", ":::for Wren and Silas".
--  - A stray ":::" at the end of the names line is ignored (":::for Wren and Silas:::").
--  - One line on its own: ":::for Wren and Silas::: The letter is forged :::".
--  - The same for GM secrets (":::gm::: The innkeeper is a spy :::"), and any line starting with ":::gm"
--    now opens a hidden block even with text after it, so ":::gm The innkeeper is a spy" can't leak.
--  - A ":::for" line with no names yet hides its passage from everyone.
-- Keep in step with splitSecrets / forNames in src/Markdown.tsx.

create or replace function public.for_names(spec text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(lower(trim(n))) filter (where trim(n) <> ''), '{}')
  from unnest(regexp_split_to_array(trim(regexp_replace(spec, '[ \t]*:::[ \t]*$', '')), '[ \t]*(,|&|\yand\y)[ \t]*', 'i')) n
$$;

create or replace function public.player_text(t text, names text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  line text;
  result text[] := '{}';
  mode text := null; -- null: normal, 'skip': inside a hidden block, 'keep': inside a passage for this viewer
  wanted text[] := coalesce((select array_agg(lower(trim(n))) from unnest(names) n), '{}');
  one text[];
begin
  if t is null then
    return '';
  end if;
  foreach line in array string_to_array(t, E'\n') loop
    if mode is null then
      one := regexp_match(line, '^:::for[ \t]+(.+?):::(.*):::[ \t]*$');
      if line ~ '^:::gm\y' then
        -- One-line secret only when there's text between the markers; ":::gm:::" alone opens a block.
        if line !~ '^:::gm\y[: \t]*[^: \t].*:::[ \t]*$' then
          mode := 'skip';
        end if;
      elsif one is not null then
        if public.for_names(one[1]) && wanted then
          result := result || ':::foryou'::text || trim(one[2]) || ':::'::text;
        end if;
      elsif line ~ '^:::for([ \t:]|$)' then
        -- With no names yet it's a secret for nobody, never for everyone.
        if public.for_names(regexp_replace(line, '^:::for[ \t:]*', '')) && wanted then
          mode := 'keep';
          result := result || ':::foryou'::text;
        else
          mode := 'skip';
        end if;
      else
        result := result || line;
      end if;
    elsif line ~ '^:::[ \t]*$' then
      if mode = 'keep' then
        result := result || line;
      end if;
      mode := null;
    elsif mode = 'keep' then
      result := result || line;
    end if;
  end loop;
  return array_to_string(result, E'\n');
end $$;
