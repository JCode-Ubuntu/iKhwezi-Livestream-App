#!/bin/sh
# Renders /etc/nginx/nginx.conf from nginx.conf.template, injecting the
# RTMP webhook secret so nginx-rtmp's on_publish callbacks authenticate against
# the backend (backend/middleware/rtmpWebhook.js). Fails fast when the secret is
# missing: a silently unauthenticated webhook would let anyone flip the site
# "live", and an unset secret makes the backend reject every callback with 503
# (which nginx-rtmp treats as "reject the publish" - OBS could never go live).
set -eu

TEMPLATE=/etc/nginx/nginx.conf.template
TARGET=/etc/nginx/nginx.conf

if [ -z "${RTMP_WEBHOOK_SECRET:-}" ]; then
  echo "ERROR: RTMP_WEBHOOK_SECRET is not set. Define it in the .env next to docker-compose.yml" >&2
  echo "       (same value the backend service receives). Refusing to start nginx-rtmp." >&2
  exit 1
fi

# Only URL/config-safe characters are allowed: the value is embedded in an nginx
# directive and sent as a query-string parameter. Generate with e.g.
#   openssl rand -hex 32
case "$RTMP_WEBHOOK_SECRET" in
  *[!A-Za-z0-9_.~-]*)
    echo "ERROR: RTMP_WEBHOOK_SECRET may only contain A-Z a-z 0-9 _ . ~ - (got other characters)." >&2
    exit 1
    ;;
esac

BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-ikhwezi-backend:3001}"
sed -e "s|__RTMP_WEBHOOK_SECRET__|${RTMP_WEBHOOK_SECRET}|g" \
    -e "s|__BACKEND_UPSTREAM__|${BACKEND_UPSTREAM}|g" "$TEMPLATE" > "$TARGET"

if grep -q "__RTMP_WEBHOOK_SECRET__\|__BACKEND_UPSTREAM__" "$TARGET"; then
  echo "ERROR: template substitution failed" >&2
  exit 1
fi

nginx -t
exec "$@"