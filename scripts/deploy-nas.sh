#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
repo_dir=$(CDPATH= cd "$script_dir/.." && pwd)
cd "$repo_dir"

compose_file=${COMPOSE_FILE:-$repo_dir/docker-compose.yml}
lock_file=${DEPLOY_LOCK_FILE:-$repo_dir/.g0dlog-deploy.lock}
release_version=${RELEASE_VERSION:-${GITHUB_REF_NAME:-}}
image_repository=${IMAGE_REPOSITORY:-ghcr.io/g0dn/g0dlog}

if [ -n "$release_version" ]; then
  case "$release_version" in
    v[0-9]*|[0-9]*) ;;
    *) echo "RELEASE_VERSION must be a release tag such as v1.2.3." >&2; exit 1 ;;
  esac
fi
if [ -z "${G0DLOG_IMAGE:-}" ]; then
  if [ -n "$release_version" ]; then G0DLOG_IMAGE="$image_repository:$release_version"; else G0DLOG_IMAGE="$image_repository:latest"; fi
fi
export G0DLOG_IMAGE

: "${PUBLIC_SITE_URL:?PUBLIC_SITE_URL must be set}"
: "${BLOG_DATA_DIR:?BLOG_DATA_DIR must be set}"
: "${BLOG_MEDIA_DIR:?BLOG_MEDIA_DIR must be set}"
: "${BLOG_BACKUP_DIR:?BLOG_BACKUP_DIR must be set}"

exec 9>"$lock_file"
if ! command -v flock >/dev/null 2>&1; then
  echo "flock is required for safe deployments; install it or configure the NAS deployment host with a flock-compatible utility." >&2
  exit 1
fi
flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }

BLOG_DATA_DIR="$BLOG_DATA_DIR" BLOG_MEDIA_DIR="$BLOG_MEDIA_DIR" BLOG_BACKUP_DIR="$BLOG_BACKUP_DIR" sh "$repo_dir/scripts/backup.sh"

previous_image=""
container_id=$(docker compose -f "$compose_file" ps -q g0dlog 2>/dev/null || true)
if [ -n "$container_id" ]; then previous_image=$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true); fi

docker compose -f "$compose_file" pull g0dlog
docker compose -f "$compose_file" up -d --no-build

wait_for_health() {
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if docker compose -f "$compose_file" exec -T g0dlog wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then return 0; fi
    sleep 5
  done
  return 1
}

if ! wait_for_health; then
  docker compose -f "$compose_file" logs --tail=100 g0dlog >&2 || true
  if [ -n "$previous_image" ]; then
    G0DLOG_IMAGE="$previous_image" docker compose -f "$compose_file" up -d --no-build
    G0DLOG_IMAGE="$previous_image"
    export G0DLOG_IMAGE
    if wait_for_health; then
      echo "Health check failed; restored the previous verified image $previous_image." >&2
    else
      echo "Health check failed and image rollback was not healthy. Restore the last verified backup before retrying." >&2
    fi
  else
    echo "Health check failed and no previous image was available. Restore the last verified backup before retrying." >&2
  fi
  node "$repo_dir/scripts/send-alert.mjs" "G0dLog deployment failed" "The deployment health check failed on $(hostname). Inspect the deployment log and restore workflow." || true
  exit 1
fi

BLOG_DATA_DIR="$BLOG_DATA_DIR" RELEASE_VERSION="$release_version" G0DLOG_IMAGE="$G0DLOG_IMAGE" node "$repo_dir/scripts/audit-deploy.mjs"
echo "G0dLog deployment is healthy: $G0DLOG_IMAGE"
