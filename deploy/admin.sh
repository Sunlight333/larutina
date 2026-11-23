#!/usr/bin/env bash
# Panel users from the server, e.g. the first admin:
#   larutina-admin create <email> "<name>" [ROLE]
#   larutina-admin reset-password <email>
#   larutina-admin reset-2fa <email>
#   larutina-admin list
# Runs code/scripts/admin.ts in the tools image of the live deploy.
set -euo pipefail
cd /opt/larutina/deploy
exec docker compose -f compose.yaml --env-file .env --profile tools run --rm -T migrate node_modules/.bin/tsx scripts/admin.ts "$@"
