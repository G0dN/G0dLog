#!/usr/bin/env sh
set -eu

DATA_DIR="${BLOG_DATA_DIR:-./data}"
MEDIA_DIR="${BLOG_MEDIA_DIR:-./media}"
BACKUP_DIR="${BLOG_BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/yinye-$STAMP"

mkdir -p "$TARGET"
[ -d "$DATA_DIR" ] && cp -R "$DATA_DIR" "$TARGET/data" || true
[ -d "$MEDIA_DIR" ] && cp -R "$MEDIA_DIR" "$TARGET/media" || true
[ -d "./drizzle" ] && cp -R ./drizzle "$TARGET/drizzle" || true

printf '%s\n' "备份完成：$TARGET"
