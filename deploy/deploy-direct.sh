#!/usr/bin/env bash
# Deploys this checkout straight to the VPS, without GitHub. Run on a
# workstation from anywhere inside the repository (Git Bash on Windows):
#
#   deploy/deploy-direct.sh                 typecheck and test, then deploy
#   deploy/deploy-direct.sh --skip-checks   deploy without running the checks
#
# It packs code/ and deploy/ as they are on disk (git's ignore rules keep out
# .env, node_modules, build output and local data; docs/ never goes), uploads
# the archive over SSH (host alias larutina-vps, see README.md) and runs the
# uploaded deploy.sh in --direct mode: build while the site keeps serving,
# backup, migrations, switch, automatic rollback.
set -euo pipefail

HOST=${DEPLOY_HOST:-larutina-vps}
REMOTE_DIR=/var/lib/larutina/incoming
checks=1
for arg in "$@"; do
  case $arg in
    --skip-checks) checks=0 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
log() { printf '[deploy-direct %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

if [ $checks = 1 ]; then
  log "Typecheck and tests (skip with --skip-checks)"
  (cd code && npm run --silent typecheck && npm test --silent)
fi

desc="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- code deploy || echo '+cambios') $(git log -1 --format=%s)"
archive=$(mktemp -t larutina-release.XXXXXX.tgz)
trap 'rm -f "$archive"' EXIT

log "Packing code/ and deploy/"
git ls-files -z --cached --others --exclude-standard -- code deploy \
  | while IFS= read -r -d '' f; do [ -e "$f" ] && printf '%s\0' "$f"; done \
  | tar --null -czf "$archive" -T -
log "Archive: $(du -h "$archive" | cut -f1)"

log "Uploading to $HOST"
ssh "$HOST" "mkdir -p $REMOTE_DIR && cat > $REMOTE_DIR/release.tgz" < "$archive"

log "Deploying on $HOST"
# The uploaded deploy.sh runs, not the server's copy, so script changes take
# effect in the same deploy.
ssh "$HOST" "tar -xzOf $REMOTE_DIR/release.tgz deploy/deploy.sh > $REMOTE_DIR/deploy.sh && DEPLOY_DESC=$(printf '%q' "$desc") bash $REMOTE_DIR/deploy.sh --direct=$REMOTE_DIR/release.tgz"
