#!/usr/bin/env bash
# Deploys the latest commit of origin/main to this server. Runs on the VPS.
#
#   deploy.sh              deploy origin/main now if it is not already live
#   deploy.sh --force      rebuild and redeploy even if nothing changed
#   deploy.sh --rollback   go back to the previous successful deploy
#   deploy.sh --status     show what is live
#   deploy.sh --auto       used by the systemd timer: quiet, skips if busy
#
# The new image is built while the current one keeps serving; the switch
# happens only after the build succeeds, and a container that does not turn
# healthy is rolled back automatically. A commit that failed is not retried
# by the timer until a newer commit arrives (or --force).
set -euo pipefail

# Everything lives in main(), so bash has parsed the whole script before
# `git reset` below can rewrite this file.
main() {
  APP_DIR=/opt/larutina
  BRANCH=${DEPLOY_BRANCH:-main}
  STATE=/var/lib/larutina
  ENV_FILE=$APP_DIR/deploy/.env
  COMPOSE=(docker compose -f "$APP_DIR/deploy/compose.yaml" --env-file "$ENV_FILE")

  local mode=deploy auto=0 force=0
  for arg in "$@"; do
    case $arg in
      --auto) auto=1 ;;
      --force) force=1 ;;
      --rollback) mode=rollback ;;
      --status) mode=status ;;
      -h|--help) sed -n '2,15p' "$0"; return 0 ;;
      *) echo "Unknown option: $arg" >&2; return 2 ;;
    esac
  done

  mkdir -p "$STATE"
  touch "$ENV_FILE" "$STATE/history"
  cd "$APP_DIR"

  if [ "$mode" = status ]; then status; return; fi

  exec 9>/run/larutina-deploy.lock
  if [ $auto = 1 ]; then
    flock -n 9 || return 0
  elif ! flock -n 9; then
    log "Another deploy is running; waiting for it to finish."
    flock -w 1800 9
  fi

  if [ "$mode" = rollback ]; then rollback; return; fi

  git fetch --quiet origin "$BRANCH"
  local new cur failed
  new=$(git rev-parse "origin/$BRANCH")
  cur=$(cat "$STATE/deployed" 2>/dev/null || true)
  failed=$(cat "$STATE/failed" 2>/dev/null || true)
  if [ $force = 0 ]; then
    if [ "$new" = "$cur" ]; then
      [ $auto = 1 ] || log "Already live: $(describe "$new")"
      return 0
    fi
    if [ "$new" = "$failed" ]; then
      [ $auto = 1 ] && return 0
      log "$(describe "$new") failed before. Push a fix, or run with --force to retry."
      return 1
    fi
  fi

  log "Deploying $(describe "$new")"
  git reset --quiet --hard "$new"

  local tag=${new:0:12} prev
  prev=$(env_get TAG)

  log "Building image larutina-web:$tag (the live site keeps serving meanwhile)"
  if ! TAG=$tag "${COMPOSE[@]}" build --pull web; then
    echo "$new" > "$STATE/failed"
    log "BUILD FAILED for $(describe "$new"). The live site is unchanged."
    return 1
  fi

  if switch_to "$tag"; then
    echo "$new" > "$STATE/deployed"
    rm -f "$STATE/failed"
    echo "$(date -u +%FT%TZ) $tag $new" >> "$STATE/history"
    "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
    cleanup
    log "LIVE: $(describe "$new")"
  else
    echo "$new" > "$STATE/failed"
    log "New container did not become healthy. Last log lines:"
    docker logs --tail 40 "$("${COMPOSE[@]}" ps -aq web)" 2>&1 || true
    if [ -n "$prev" ] && [ "$prev" != "$tag" ]; then
      log "Rolling back to larutina-web:$prev"
      switch_to "$prev" || log "Rollback container is not healthy either; check 'docker compose ps'."
    fi
    return 1
  fi
}

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

describe() { git log -1 --format='%h "%s" (%an, %ar)' "$1" 2>/dev/null || echo "$1"; }

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }

env_set() {
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}

# Points the stack at an image tag, starts it, waits for the health check.
switch_to() {
  env_set TAG "$1"
  "${COMPOSE[@]}" up -d --remove-orphans
  local cid status i
  cid=$("${COMPOSE[@]}" ps -q web)
  for i in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
    case $status in
      healthy) return 0 ;;
      unhealthy|missing) return 1 ;;
    esac
    sleep 2
  done
  return 1
}

rollback() {
  local cur tag rev
  cur=$(env_get TAG)
  # Most recent successful deploy other than the live one whose image still exists.
  while read -r _ tag rev _; do
    [ "$tag" = "$cur" ] && continue
    docker image inspect "larutina-web:$tag" >/dev/null 2>&1 || continue
    log "Rolling back from $cur to $(describe "$rev")"
    if switch_to "$tag"; then
      # Keep the timer from redeploying the commit we just left.
      cat "$STATE/deployed" > "$STATE/failed" 2>/dev/null || true
      echo "$rev" > "$STATE/deployed"
      echo "$(date -u +%FT%TZ) $tag $rev rollback" >> "$STATE/history"
      log "LIVE: $(describe "$rev"). The timer will deploy again when a new commit reaches $BRANCH."
      return 0
    fi
    log "That image is not healthy; trying an older one."
  done < <(tac "$STATE/history")
  log "No earlier image available to roll back to."
  return 1
}

status() {
  local rev
  rev=$(cat "$STATE/deployed" 2>/dev/null || true)
  echo "Live:     ${rev:+$(describe "$rev")}"
  echo "Image:    larutina-web:$(env_get TAG)"
  [ -s "$STATE/failed" ] && echo "Failed:   $(describe "$(cat "$STATE/failed")")"
  echo "Recent deploys:"; tail -5 "$STATE/history" | sed 's/^/  /'
  echo; "${COMPOSE[@]}" ps
}

# Keep the five newest app images (plus the live one) and a week of build cache.
cleanup() {
  local cur
  cur=$(env_get TAG)
  docker image ls larutina-web --format '{{.Tag}}' | tail -n +6 | while read -r t; do
    [ "$t" = "$cur" ] || docker image rm "larutina-web:$t" >/dev/null 2>&1 || true
  done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
}

main "$@"
exit $?
