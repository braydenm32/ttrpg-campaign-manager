#!/bin/sh
# Runs the tests in supabase/tests on a throwaway Postgres that's deleted afterwards, so nothing here
# touches the real database. Needs Postgres 16 or newer (initdb, pg_ctl and psql; set PGBIN to their
# folder if pg_config can't find them) and Node 22.18 or newer, after npm install. From the repo folder:
#   sh supabase/tests/run.sh
# Postgres won't run as root, so run it as an ordinary user. On a Mac, add PGLOCALE=en_US.UTF-8.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
pgbin=${PGBIN:-$(pg_config --bindir 2>/dev/null || true)}
if [ -n "$pgbin" ]; then PATH="$pgbin:$PATH"; fi
tmp=$(mktemp -d)
port=${PGTESTPORT:-54329}
finish() {
  pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap finish EXIT INT TERM

# A Unicode locale, as on Supabase, so names in other alphabets compare without capitals too.
initdb -D "$tmp/data" -U supabase_admin -A trust -E UTF8 --locale="${PGLOCALE:-C.UTF-8}" >/dev/null
pg_ctl -D "$tmp/data" -o "-k $tmp -p $port -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null
db() { psql -X -q -v ON_ERROR_STOP=1 -h "$tmp" -p "$port" "$@"; }
# As on Supabase: "postgres" owns the app's tables but isn't a superuser.
db -U supabase_admin -d postgres -c 'create role postgres login createrole bypassrls' -c 'create database atlas owner postgres'
db -U supabase_admin -d atlas -f "$here/stubs.sql"

node --disable-warning=ExperimentalWarning "$here/example-world.mjs" > "$tmp/example-world.sql"
db -U postgres -d atlas -v example="$tmp/example-world.sql" -f "$here/security_audit.sql"
node --disable-warning=ExperimentalWarning "$here/shared-asset.test.mjs"
