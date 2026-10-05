#!/bin/sh
set -eu
password="$(cat /run/secrets/redis_password)"
case "$password" in *[!a-zA-Z0-9_-]*|'') echo 'Invalid Redis secret format' >&2; exit 1;; esac
[ "${#password}" -ge 32 ] || exit 1
umask 077
printf 'bind 0.0.0.0\nprotected-mode yes\nappendonly yes\ndir /data\nrequirepass %s\n' "$password" > /run/redis/redis.conf
unset password
exec redis-server /run/redis/redis.conf
