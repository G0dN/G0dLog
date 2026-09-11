#!/usr/bin/env sh
# Docker-only fallback for NAS systems without Compose. Run from the directory
# containing .env. Stop/remove the existing g0dlog container before recreating it.
set -eu
set -a
. ./.env
set +a
: "${G0DLOG_IMAGE:?required}"
: "${PUBLIC_SITE_URL:?required}"
: "${BLOG_DATA_DIR:?required}"
: "${BLOG_MEDIA_DIR:?required}"
: "${BLOG_BACKUP_DIR:?required}"
docker run -d --name g0dlog --restart unless-stopped \
  -p "${BLOG_BIND_IP:-0.0.0.0}:${BLOG_PORT:-3000}:3000" \
  -e NODE_ENV=production -e HOSTNAME=0.0.0.0 \
  -e PUBLIC_SITE_URL="$PUBLIC_SITE_URL" \
  -e ALLOW_INSECURE_LAN="${ALLOW_INSECURE_LAN:-0}" \
  -e BLOG_DATA_DIR=/var/lib/g0dlog/data \
  -e BLOG_MEDIA_DIR=/var/lib/g0dlog/media \
  -e BLOG_BACKUP_DIR=/var/lib/g0dlog/backups \
  --mount "type=bind,src=$BLOG_DATA_DIR,dst=/var/lib/g0dlog/data" \
  --mount "type=bind,src=$BLOG_MEDIA_DIR,dst=/var/lib/g0dlog/media" \
  --mount "type=bind,src=$BLOG_BACKUP_DIR,dst=/var/lib/g0dlog/backups" \
  "$G0DLOG_IMAGE"
