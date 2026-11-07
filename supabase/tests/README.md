# Server tests

Tests for the database rules and the `shared-asset` file function, run on a throwaway copy of
Postgres on your own computer. Nothing here touches the real database.

Run them all from the repo folder (needs Postgres 16 or newer and Node 22.18 or newer, after
`npm install`; on a Mac add `PGLOCALE=en_US.UTF-8` in front):

```sh
sh supabase/tests/run.sh
```

It ends with `passed | failed` and a list of anything that failed (nothing, when all is well), then
`all 14 passed` for the file function.

- `security_audit.sql` loads every migration up to `20261106000000_rename_players.sql`, a made-up
  world (`seed.sql`) and the Vael Ardith example world (`example-world.mjs`), saves what every kind of
  viewer receives (`snapshot.sql`), applies `20261107000000_security_audit.sql` twice, and runs
  `checks.sql`: the November 2026 leaks are gone, nothing else players receive changed, and GMs,
  co-GMs and players can still save, join, rename, claim characters and write notes.
- `stubs.sql` stands in for the parts of Supabase the migrations use (roles, `auth`, `storage`).
- `shared-asset.test.mjs` runs `supabase/functions/shared-asset/handler.ts` against a pretend Supabase.

To add a check, add a `t.check(...)` line to `checks.sql` (the helpers are in `lib.sql`).
