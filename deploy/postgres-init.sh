#!/bin/sh
set -eu
case "${APP_DB_USER:-}" in ''|ggvault_owner|*[!a-zA-Z0-9_]*) echo 'Invalid application database role' >&2; exit 1 ;; esac
GGVAULT_INIT_PASSWORD=$(cat /run/secrets/db_password)
[ "${#GGVAULT_INIT_PASSWORD}" -ge 32 ] || exit 1
export GGVAULT_INIT_PASSWORD
# psql variables quote identifiers/literals; never interpolate SQL from a credential.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_user="$APP_DB_USER" <<'SQL'
\getenv app_password GGVAULT_INIT_PASSWORD
CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
unset GGVAULT_INIT_PASSWORD
