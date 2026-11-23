#!/usr/bin/env bash
# Backups on the VPS: pg_dump custom-format files and media archives in
# /var/backups/larutina. Restoring: see README.md.
#
#   backup.sh             daily database dump (kept 14 days) and media copy (kept 7),
#                         run by larutina-backup.timer
#   backup.sh predeploy   dump taken by deploy.sh before migrations (newest 10 kept)
#   backup.sh --list      list the backups, oldest first
set -euo pipefail

APP_DIR=/opt/larutina
DIR=/var/backups/larutina
COMPOSE=(docker compose -f "$APP_DIR/deploy/compose.yaml" --env-file "$APP_DIR/deploy/.env")
DAILY_DAYS=14
PREDEPLOY_KEEP=10
MEDIA_DAYS=7

kind=daily
case ${1:-} in
  "") ;;
  predeploy) kind=predeploy ;;
  --list)
    find "$DIR" \( -name '*.dump' -o -name '*.tar.gz' \) -printf '%TY-%Tm-%Td %TH:%TM %s %f\n' 2>/dev/null | sort | numfmt --field=3 --to=iec
    exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

umask 077
mkdir -p "$DIR"
rm -f "$DIR"/*.partial
file="$DIR/larutina-$kind-$(date -u +%Y%m%d-%H%M%S).dump"
"${COMPOSE[@]}" exec -T db pg_dump -U larutina -d larutina --format=custom > "$file.partial"
mv "$file.partial" "$file"

if [ $kind = daily ]; then
  find "$DIR" -name 'larutina-daily-*.dump' -mtime +$((DAILY_DAYS - 1)) -delete
  # Uploaded media (catalog images, contact attachments): the web container's volume.
  media="$DIR/media-$(date -u +%Y%m%d-%H%M%S).tar.gz"
  if "${COMPOSE[@]}" exec -T web tar -C /app/storage -czf - . > "$media.partial"; then
    mv "$media.partial" "$media"
    echo "[backup] $media ($(du -h "$media" | cut -f1))"
  else
    rm -f "$media.partial"
    echo "[backup] media copy failed" >&2
  fi
  find "$DIR" -name 'media-*.tar.gz' -mtime +$((MEDIA_DAYS - 1)) -delete
else
  ls -1t "$DIR"/larutina-predeploy-*.dump | tail -n +$((PREDEPLOY_KEEP + 1)) | xargs -r rm -f
fi
echo "[backup] $file ($(du -h "$file" | cut -f1))"
