#!/usr/bin/env bash
# Uptime and health watch (INF-04), run every minute by larutina-monitor.timer.
# Checks the site and the panel (admin.…) through Caddy, the app's /api/health
# (app + database), the containers, disk space and the age of the last backup. A problem is alerted
# once when it starts and once when it clears, through ALERT_WEBHOOK_URL in
# deploy/.env (any endpoint that accepts a JSON POST: Slack, Discord, a
# Telegram relay…). Without a webhook, problems only go to the journal.
#
#   monitor.sh          run the checks (quiet when all is well)
#   monitor.sh --test   send a test alert
set -uo pipefail

APP_DIR=/opt/larutina
ENV_FILE=$APP_DIR/deploy/.env
STATE=/var/lib/larutina/monitor
COMPOSE=(docker compose -f "$APP_DIR/deploy/compose.yaml" --env-file "$ENV_FILE")
mkdir -p "$STATE"

env_get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
DOMAIN=$(env_get SITE_DOMAIN); DOMAIN=${DOMAIN:-larutinabeauty.com}
WEBHOOK=$(env_get ALERT_WEBHOOK_URL)

notify() {
  local text="[$DOMAIN] $1"
  echo "$text"
  [ -n "$WEBHOOK" ] || return 0
  local json
  json=$(printf '%s' "$text" | python3 -c 'import json,sys; t=sys.stdin.read(); print(json.dumps({"text": t, "content": t}))' 2>/dev/null) || json="{\"text\": \"monitor alert\"}"
  curl -fsS -m 10 -H 'Content-Type: application/json' -d "$json" "$WEBHOOK" >/dev/null || echo "monitor: webhook failed" >&2
}

if [ "${1:-}" = --test ]; then notify "Test alert from the monitor. Alerts reach this channel."; exit 0; fi

# check <name> <command…>: alert on the first failure, and on recovery.
check() {
  local name=$1; shift
  local flag="$STATE/$name.down" out
  if out=$("$@" 2>&1); then
    if [ -f "$flag" ]; then rm -f "$flag"; notify "RECOVERED: $name"; fi
  else
    if [ ! -f "$flag" ]; then
      # Two consecutive failures before alerting, so a deploy swap or a blip does not page.
      if [ -f "$flag.pending" ]; then rm -f "$flag.pending"; touch "$flag"; notify "DOWN: $name — ${out:0:300}"; else touch "$flag.pending"; fi
    fi
    return
  fi
  rm -f "$flag.pending"
}

site()     { curl -fsS -o /dev/null -m 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/live"; }
panel()    { curl -fsS -o /dev/null -m 15 --resolve "admin.$DOMAIN:443:127.0.0.1" "https://admin.$DOMAIN/login"; }
health()   { curl -fsS -m 15 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" | grep -q '"ok":true'; }
containers() {
  local bad
  bad=$("${COMPOSE[@]}" ps --format '{{.Service}} {{.State}} {{.Health}}' | awk '$2!="running" || ($3!="" && $3!="healthy") {print}')
  [ -z "$bad" ] || { echo "$bad"; return 1; }
}
disk()     { local use; use=$(df --output=pcent / | tail -1 | tr -dc 0-9); [ "$use" -lt 85 ] || { echo "disk ${use}% used"; return 1; }; }
restore()  { [ -n "$(find /var/lib/larutina/restore-check -mtime -8 2>/dev/null)" ] || { echo 'no successful restore rehearsal in the last 8 days'; return 1; }; }
backup()   { [ -n "$(find /var/backups/larutina -name 'larutina-daily-*.dump' -mtime -2 2>/dev/null | head -1)" ] || { echo "no daily backup in the last 48 h"; return 1; }; }

check site site
check panel panel
check health health
check containers containers
check disk disk
# The first nightly backup runs after the database exists; skip until then.
if [ -d /var/backups/larutina ]; then
  check backup backup
  # The weekly rehearsal starts after the first backup exists.
  [ -f /var/lib/larutina/restore-check ] && check restore restore
fi
exit 0
