#!/bin/sh
set -eu
reject() { echo 'Gateway configuration rejected; review domains, VPN subnet and individual access rosters.' >&2; exit 1; }
for domain in "${PLAYER_DOMAIN:-}" "${ADMIN_DOMAIN:-}"; do
  case "$domain" in ''|*[!a-zA-Z0-9.-]*|.*|*.) reject ;; esac
done
[ "$PLAYER_DOMAIN" != "$ADMIN_DOMAIN" ] || reject
case "${ADMIN_VPN_CIDR:-}" in ''|0.0.0.0/0|::/0|*[!a-fA-F0-9.:/]*) reject ;; esac
printf '%s\n' "$ADMIN_VPN_CIDR" | awk -F/ 'NF != 2 || $2 !~ /^[0-9]+$/ || $2+0 < 1 || ($1 ~ /:/ ? $2+0 > 128 : $2+0 > 32) { exit 1 }' || reject
case "${BETA_INVITE_CAP:-10}" in ''|*[!0-9]*) reject ;; esac
[ "${BETA_INVITE_CAP:-10}" -ge 1 ] && [ "${BETA_INVITE_CAP:-10}" -le 50 ] || reject
check_roster() {
  awk -F: -v cap="$2" '
    NF != 2 || $1 !~ /^[A-Za-z0-9_-]+$/ || $2 !~ /^\$2[aby]\$/ || length($2) != 60 { bad=1 }
    seen[$1]++ { bad=1 }
    END { if (bad || NR < 1 || NR > cap) exit 1 }
  ' "$1" || reject
}
check_roster /run/secrets/player_access "${BETA_INVITE_CAP:-10}"
check_roster /run/secrets/admin_access 50
exec /docker-entrypoint.sh "$@"
