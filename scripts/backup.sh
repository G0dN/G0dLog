#!/usr/bin/env sh
set -eu

: "${BLOG_DATA_DIR:?BLOG_DATA_DIR must be set}"
: "${BLOG_MEDIA_DIR:?BLOG_MEDIA_DIR must be set}"
: "${BLOG_BACKUP_DIR:?BLOG_BACKUP_DIR must be set}"
data_dir=$BLOG_DATA_DIR
media_dir=$BLOG_MEDIA_DIR
backup_dir=$BLOG_BACKUP_DIR
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_dir/g0dlog-$stamp"
tmp="$backup_dir/.g0dlog-$stamp.tmp"

mkdir -p "$backup_dir"
rm -rf "$tmp"
mkdir -p "$tmp/data" "$tmp/media"
BLOG_DATA_DIR="$data_dir" node scripts/snapshot-sqlite.mjs "$tmp/data/blog.sqlite"
# Backups belong to the backup user; preserving root-owned image file ownership
# produces permission warnings when this script runs as the container's node user.
if [ -d "$media_dir" ]; then cp -R "$media_dir/." "$tmp/media/"; fi
for file in docker-compose.yml Dockerfile package.json pnpm-lock.yaml .env.example README.md LICENSE next.config.ts; do
  if [ -f "$file" ]; then cp "$file" "$tmp/"; fi
done
if [ -d docs ]; then cp -R docs "$tmp/docs"; fi
if [ -d drizzle ]; then cp -R drizzle "$tmp/drizzle"; fi
if [ -d scripts ]; then cp -R scripts "$tmp/scripts"; fi

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$tmp" && find . -type f ! -path './manifest.sha256' -print | sort | xargs sha256sum > manifest.sha256 && sha256sum -c manifest.sha256 >/dev/null)
else
  (cd "$tmp" && find . -type f ! -path './manifest.sha256' -print | sort | xargs shasum -a 256 > manifest.sha256 && shasum -a 256 -c manifest.sha256 >/dev/null)
fi
mv "$tmp" "$target"
BLOG_DATA_DIR="$data_dir" node scripts/prune-audit.mjs >/dev/null
printf '%s\n' "Created backup: $target"
