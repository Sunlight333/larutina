#!/usr/bin/env bash
# Deploys LaRutina on this server. Runs on the VPS.
#
#   deploy.sh --direct=<archive>  deploy an upload of code/ and deploy/ (the normal
#                          way: deploy/deploy-direct.sh on a workstation sends it)
#   deploy.sh              deploy origin/main now if it is not already live
#   deploy.sh --force      rebuild and redeploy even if nothing changed
#   deploy.sh --rollback   go back to the previous successful deploy
#   deploy.sh --status     show what is live
#   deploy.sh --auto       used by the systemd timer: quiet, skips if busy
#
# The new image is built while the current one keeps serving. Database
# migrations run next (after a backup), and the switch happens only after the
# build and the migrations succeed; a container that does not turn healthy is
# rolled back automatically. A commit that failed is not retried by the timer
# until a newer commit arrives (or --force).
set -euo pipefail

# Everything lives in main(), so bash has parsed the whole script before
# `git reset` below can rewrite this file.
main() {
  APP_DIR=/opt/larutina
  BRANCH=${DEPLOY_BRANCH:-main}
  STATE=/var/lib/larutina
  ENV_FILE=$APP_DIR/deploy/.env
  COMPOSE=(docker compose -f "$APP_DIR/deploy/compose.yaml" --env-file "$ENV_FILE")

  # Caddy mounts the Caddyfile as a single file. A deploy replaces that file,
  # and the running container keeps reading the old copy, so a reload alone
  # misses the change: recreate Caddy when the two differ, reload otherwise.
  refresh_caddy() {
    if "${COMPOSE[@]}" exec -T caddy cat /etc/caddy/Caddyfile 2>/dev/null | cmp -s - "$APP_DIR/deploy/Caddyfile"; then
      "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
    else
      "${COMPOSE[@]}" up -d --no-deps --force-recreate caddy >/dev/null 2>&1 || true
    fi
  }

  local mode=deploy auto=0 force=0
  for arg in "$@"; do
    case $arg in
      --auto) auto=1 ;;
      --force) force=1 ;;
      --rollback) mode=rollback ;;
      --status) mode=status ;;
      --direct=*) mode=direct; ARCHIVE=${arg#--direct=} ;;
      -h|--help) sed -n '2,16p' "$0"; return 0 ;;
      *) echo "Unknown option: $arg" >&2; return 2 ;;
    esac
  done

  mkdir -p "$STATE"
  touch "$ENV_FILE" "$STATE/history"
  chmod 600 "$ENV_FILE"
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
  if [ "$mode" = direct ]; then direct_deploy "$ARCHIVE"; return; fi

  git fetch --quiet origin "$BRANCH"
  local new cur failed
  new=$(git rev-parse "origin/$BRANCH")
  cur=$(cat "$STATE/deployed" 2>/dev/null || true)
  failed=$(cat "$STATE/failed" 2>/dev/null || true)
  if [ $force = 0 ]; then
    # Live and deployed with this server configuration (deploy/ as of that
    # commit): nothing to do. A commit deployed by an older deploy.sh is
    # deployed again, so changes to this folder always take effect.
    if [ "$new" = "$cur" ] && [ "$(stack_id "$new")" = "$(cat "$STATE/stack" 2>/dev/null || true)" ]; then
      [ $auto = 1 ] || log "Already live: $(describe "$new")"
      return 0
    fi
    if [ "$new" = "$failed" ]; then
      [ $auto = 1 ] && return 0
      log "$(describe "$new") failed before. Push a fix, or run with --force to retry."
      return 1
    fi
    [ "$new" = "$cur" ] && log "Server configuration changed since $(describe "$new") was deployed; applying it."
  fi

  log "Deploying $(describe "$new")"
  git reset --quiet --hard "$new"
  chmod +x deploy/*.sh
  ensure_secrets
  install_units

  local tag=${new:0:12} prev
  prev=$(env_get TAG)

  log "Building images for $tag (the live site keeps serving meanwhile)"
  if ! TAG=$tag "${COMPOSE[@]}" --profile tools build --pull web migrate; then
    echo "$new" > "$STATE/failed"
    log "BUILD FAILED for $(describe "$new"). The live site is unchanged."
    return 1
  fi

  if ! migrate "$tag"; then
    echo "$new" > "$STATE/failed"
    log "MIGRATIONS FAILED for $(describe "$new"). The live site still runs the previous version."
    return 1
  fi

  if switch_to "$tag"; then
    echo "$new" > "$STATE/deployed"
    stack_id "$new" > "$STATE/stack"
    rm -f "$STATE/failed"
    echo "$(date -u +%FT%TZ) $tag $new" >> "$STATE/history"
    refresh_caddy
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

# Direct deploy: an archive of code/ and deploy/ uploaded over SSH replaces
# those folders (the server's deploy/.env stays) and goes through the same
# build, backup, migrations, switch and automatic rollback as a git deploy.
# The tag names the upload: d<UTC time>-<archive hash>.
direct_deploy() {
  local archive=$1 desc=${DEPLOY_DESC:-direct upload} stage=$STATE/release sum tag prev
  [ -f "$archive" ] || { log "No archive at $archive"; return 2; }
  rm -rf "$stage"; mkdir -p "$stage"
  tar -xzf "$archive" -C "$stage"
  if [ ! -f "$stage/code/package.json" ] || [ ! -f "$stage/deploy/compose.yaml" ]; then
    log "The upload does not hold code/ and deploy/; nothing changed."; return 2
  fi
  sum=$(sha256sum "$archive" | cut -c1-10)
  tag="d$(date -u +%Y%m%d%H%M)-$sum"
  log "Deploying upload $sum: $desc"
  rsync -a --delete "$stage/code/" "$APP_DIR/code/"
  rsync -a --delete --exclude .env "$stage/deploy/" "$APP_DIR/deploy/"
  rm -rf "$stage"
  chmod +x deploy/*.sh
  ensure_secrets
  install_units
  prev=$(env_get TAG)

  log "Building images for $tag (the live site keeps serving meanwhile)"
  if ! TAG=$tag "${COMPOSE[@]}" --profile tools build --pull web migrate; then
    log "BUILD FAILED for upload $sum. The live site is unchanged."; return 1
  fi
  if ! migrate "$tag"; then
    log "MIGRATIONS FAILED for upload $sum. The live site still runs the previous version."; return 1
  fi
  if switch_to "$tag"; then
    echo "direct:$sum $desc" > "$STATE/deployed"
    rm -f "$STATE/failed"
    echo "$(date -u +%FT%TZ) $tag direct:$sum" >> "$STATE/history"
    refresh_caddy
    cleanup
    log "LIVE: $desc ($tag)"
  else
    log "New container did not become healthy. Last log lines:"
    docker logs --tail 40 "$("${COMPOSE[@]}" ps -aq web)" 2>&1 || true
    if [ -n "$prev" ] && [ "$prev" != "$tag" ]; then
      log "Rolling back to larutina-web:$prev"
      switch_to "$prev" || log "Rollback container is not healthy either; check 'docker compose ps'."
    fi
    return 1
  fi
}

# Identifies the server configuration of a commit: the git tree of deploy/.
stack_id() { git rev-parse "$1:deploy" 2>/dev/null || true; }

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }

env_set() {
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}

# The database password is created here, once, and lives only in deploy/.env.
# PostgreSQL takes it when its data volume is first created, so it must never
# change or be removed afterwards.
ensure_secrets() {
  if [ -z "$(env_get POSTGRES_PASSWORD)" ]; then
    env_set POSTGRES_PASSWORD "$(openssl rand -hex 32)"
    log "Created the database password in $ENV_FILE."
  fi
}

# systemd units from deploy/systemd: installed or updated, timers enabled;
# and the larutina-admin command (panel users).
install_units() {
  local f changed=0
  ln -sf "$APP_DIR/deploy/admin.sh" /usr/local/bin/larutina-admin
  for f in "$APP_DIR"/deploy/systemd/*.service "$APP_DIR"/deploy/systemd/*.timer; do
    if ! cmp -s "$f" "/etc/systemd/system/$(basename "$f")"; then
      install -m 0644 "$f" /etc/systemd/system/
      changed=1
    fi
  done
  [ $changed = 0 ] || systemctl daemon-reload
  for f in "$APP_DIR"/deploy/systemd/*.timer; do
    # Deploys are uploaded directly (deploy-direct.sh): polling GitHub stays off,
    # so a push never replaces what was deployed.
    if [ "$(basename "$f")" = larutina-deploy.timer ]; then
      systemctl disable --now larutina-deploy.timer >/dev/null 2>&1 || true
      continue
    fi
    systemctl is-enabled --quiet "$(basename "$f")" || systemctl enable --now "$(basename "$f")"
  done
}

# Starts the database if needed, backs it up when it already holds data,
# applies the commit's migrations and loads missing starting content.
# Migrations must stay compatible with the previous app version (add first,
# remove in a later deploy), because that version keeps serving until the
# switch and is what a rollback returns to.
migrate() {
  local tag=$1
  "${COMPOSE[@]}" up -d --wait db || return 1
  if [ -n "$("${COMPOSE[@]}" exec -T db psql -U larutina -d larutina -Atc "select 1 from information_schema.tables where table_name = '_prisma_migrations'" 2>/dev/null)" ]; then
    "$APP_DIR/deploy/backup.sh" predeploy || return 1
  fi
  log "Applying database migrations"
  TAG=$tag "${COMPOSE[@]}" --profile tools run --rm migrate || return 1
  # Starting content (Home, pages, legal drafts, announcements): creates only
  # what is missing and never overwrites what the panel changed.
  log "Loading starting content where missing"
  TAG=$tag "${COMPOSE[@]}" --profile tools run --rm -T migrate node_modules/.bin/tsx scripts/seed-content.ts
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
      stack_id "$rev" > "$STATE/stack"
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
  echo "Latest backups:"; "$APP_DIR/deploy/backup.sh" --list 2>/dev/null | tail -3 | sed 's/^/  /'
  echo "Restore check: $(cat "$STATE/restore-check" 2>/dev/null || echo 'not run yet')"
  echo "Off-site copy: $(cat "$STATE/offsite" 2>/dev/null || echo 'not run yet')"
  echo; "${COMPOSE[@]}" ps
}

# Keep the five newest app images (plus the live one), only the live
# migration image, and a week of build cache.
cleanup() {
  local cur t
  cur=$(env_get TAG)
  docker image ls larutina-web --format '{{.Tag}}' | tail -n +6 | while read -r t; do
    [ "$t" = "$cur" ] || docker image rm "larutina-web:$t" >/dev/null 2>&1 || true
  done
  docker image ls larutina-migrate --format '{{.Tag}}' | while read -r t; do
    [ "$t" = "$cur" ] || docker image rm "larutina-migrate:$t" >/dev/null 2>&1 || true
  done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
}

main "$@"
exit $?
