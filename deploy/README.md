# Deploy

Production runs on a VPS in São Paulo (Vultr, Ubuntu 24.04) behind Cloudflare, at **https://larutinabeauty.com**.

```
visitor ─► Cloudflare (DNS, proxy) ─► VPS :443 Caddy (Let's Encrypt) ─► web: Next.js standalone ─► db: PostgreSQL 17
                                                     (all in Docker; db is reachable only from the other containers)
```

| File | Role |
| --- | --- |
| [`../code/Dockerfile`](../code/Dockerfile) | Builds the app into a small Node 24 image (`output: 'standalone'`), and the one-shot migration image |
| [`compose.yaml`](compose.yaml) | The stack: `web` (the app), `db` (PostgreSQL), `caddy` (HTTPS, `www` → apex redirect), and `migrate` (run by the deploy only) |
| [`Caddyfile`](Caddyfile) | Domain, certificate, reverse proxy |
| [`deploy.sh`](deploy.sh) | Runs on the server: build, backup, migrations, switch, health check, automatic rollback |
| [`backup.sh`](backup.sh) | Database dumps (nightly, and before every deploy that migrates), nightly media copy, weekly restore rehearsal |
| [`monitor.sh`](monitor.sh) | Every minute: site, app and database health, containers, disk, backup age; alerts on change |
| [`admin.sh`](admin.sh) | `larutina-admin`: create panel users, reset a password or 2FA |
| [`setup-server.sh`](setup-server.sh) | One-time server provisioning (Docker, firewall, fail2ban, clone, timer) |
| [`systemd/`](systemd) | Timers: deploy within a minute of a push; nightly backup; weekly restore check; monitor every minute |

On the server: code in `/opt/larutina`, settings in `/opt/larutina/deploy/.env` (git-ignored, readable by root only), deploy state in `/var/lib/larutina`, backups in `/var/backups/larutina`. The `.env` holds `SITE_DOMAIN`, the live image `TAG`, `POSTGRES_PASSWORD`, which the first deploy creates, and optionally `ALERT_WEBHOOK_URL` (see Monitoring). PostgreSQL takes that password when its data volume is created, so it must never be changed or removed from the file.

Uploaded media (catalog images, contact attachments) live in the `larutina_media` volume, mounted at `/app/storage` in the app container.

## First admin and panel users

The panel is at `/admin`. Every user signs in with a password and a code from an authenticator app (set up at the first sign-in). Create the first user on the server; the rest from the panel (Sistema → Usuarios):

```bash
ssh larutina-vps larutina-admin create <email> "<Nombre>" ADMIN   # prints a temporary password
ssh larutina-vps larutina-admin reset-password <email>
ssh larutina-vps larutina-admin reset-2fa <email>                 # lost phone
ssh larutina-vps larutina-admin list
```

While the site is in "Próximamente" or maintenance mode, visitors see that page and signed-in users see the whole site. To let someone review it without an account, send the preview link from Configuración → Sitio.

## How to deploy

**Push to `main`. That's it.** The server checks `origin/main` every minute and deploys any new commit, so a deploy works from any machine or chat session that can push to GitHub, with no server access needed. The image is built while the current version keeps serving, and the switch happens only after the new container passes its health check. Database migrations (`code/prisma/migrations`) run after the build and before the switch, preceded by a backup once the database holds data. If the build, the migrations or the health check fail, the previous version keeps serving or is restored automatically, and that commit is not retried until a newer one arrives. Changes to this `deploy/` folder apply the same way: a commit that changes it is deployed again by the new `deploy.sh` within a minute, which also installs new or changed timers.

With SSH access (host alias `larutina-vps`, see below) you can also deploy immediately and watch the output:

```bash
ssh larutina-vps larutina-deploy             # deploy origin/main now
ssh larutina-vps larutina-deploy --status    # what is live, recent deploys, containers
ssh larutina-vps larutina-deploy --rollback  # back to the previous deploy
ssh larutina-vps larutina-deploy --force     # rebuild even if nothing changed
ssh larutina-vps journalctl -u larutina-deploy -n 100 --no-pager   # auto-deploy log
ssh larutina-vps 'cd /opt/larutina/deploy && docker compose logs --tail 100 web'
```

A deploy takes about two to three minutes, mostly `npm ci` and `next build`. While containers are swapped, Caddy holds requests for up to 30 seconds rather than failing them.

To pause auto-deploys: `ssh larutina-vps systemctl disable --now larutina-deploy.timer` (`enable --now` to resume).

## Database

PostgreSQL 17 in the `db` container, data in the `larutina_db-data` volume. It publishes no port; only the app and the migration container reach it.

**Migrations** are the files in `code/prisma/migrations` (create them locally with `npm run db:migrate`). The deploy applies the new ones before switching, while the previous version is still serving, and a rollback returns to that previous version without undoing them. So a migration must work with the app version before it: add a column or table first, start using it, and drop the old one in a later deploy.

**Backups** go to `/var/backups/larutina` as `pg_dump` files: one every night at 03:30 Buenos Aires time, kept 14 days, and one before each deploy that runs migrations, newest 10 kept. The media volume is archived nightly too, kept 7 days. Every Sunday the latest dump is restored into a scratch database and checked (`backup.sh --verify`); the result shows in `larutina-deploy --status`, and the monitor alerts if it fails. Backups are on the VPS only for now: encrypted off-site copies and point-in-time recovery need an object storage account.

```bash
ssh larutina-vps /opt/larutina/deploy/backup.sh            # back up now
ssh larutina-vps /opt/larutina/deploy/backup.sh --list     # list backups
ssh larutina-vps /opt/larutina/deploy/backup.sh --verify   # restore rehearsal now
ssh larutina-vps 'cd /opt/larutina/deploy && docker compose exec db psql -U larutina'   # SQL console
```

To restore a backup, on the server:

```bash
cd /opt/larutina/deploy
docker compose stop web
docker compose exec -T db pg_restore -U larutina -d larutina --clean --if-exists --no-owner < /var/backups/larutina/<file>.dump
docker compose start web
```

## Monitoring

`monitor.sh` runs every minute on the server. It checks the site through Caddy (`/api/live`), the app and database (`/api/health`), that every container is running and healthy, disk use under 85%, a nightly backup in the last 48 hours, and a successful restore rehearsal in the last 8 days. Each problem is reported once when it starts (after two failed checks in a row, so a deploy swap does not page) and once when it clears. The app also reports every unhandled server error.

Alerts go to `ALERT_WEBHOOK_URL` in `/opt/larutina/deploy/.env`: any URL that accepts a JSON POST with a `text` or `content` field (a Slack or Discord incoming webhook works as is). After adding it, run `larutina-deploy --force` so the app picks it up, and `/opt/larutina/deploy/monitor.sh --test` to see an alert arrive. Without it, problems are only written to the journal (`journalctl -u larutina-monitor`).

For an outside view as well (the server cannot report its own outage), point any uptime service at `https://larutinabeauty.com/api/health`.

## SSH access

Key-based only. A machine that should deploy by SSH needs its public key in `/root/.ssh/authorized_keys` on the server, and an entry like this in `~/.ssh/config`:

```
Host larutina-vps
    HostName <server IP>
    User root
    IdentityFile ~/.ssh/id_ed25519_larutina_vps
    IdentitiesOnly yes
```

Never commit keys, passwords or the server's `.env`. The repository is public.

## DNS and Cloudflare

The domain's DNS is on Cloudflare. Records, in **DNS → Records**:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | server IP | see steps |
| A | `www` | server IP | see steps |

Remove any other `A`, `AAAA` or `CNAME` records on `@` and `www`. No `AAAA` record is needed: once proxied, Cloudflare serves visitors over IPv6 by itself and reaches the server over IPv4.

1. Create both records as **DNS only** (grey cloud). Caddy gets the Let's Encrypt certificate within a minute or two of the records resolving to the server.
2. Once `https://larutinabeauty.com` loads with a valid certificate, switch both records to **Proxied** (orange cloud).
3. **SSL/TLS → Overview:** encryption mode **Full (strict)**. Not Flexible: that causes a redirect loop.
4. **SSL/TLS → Edge Certificates:** leave **Always Use HTTPS** off. Caddy already redirects HTTP to HTTPS, and keeping port 80 reachable lets it renew the certificate through the proxy with no extra rules. If it must be on, add a rule that exempts `/.well-known/acme-challenge/*` from it.
5. Don't put bot challenges in front of `/.well-known/acme-challenge/*` (Bot Fight Mode, "Under Attack", WAF rules); they block renewals.

## Rebuilding the server from scratch

On a fresh Ubuntu 24.04 VPS, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Sunlight333/larutina/main/deploy/setup-server.sh | bash
larutina-deploy
```

The first deploy creates an empty database with a new password. To move the data, copy a backup from the old server and restore it as above. Then point DNS at the new IP as above. To serve another domain, set `SITE_DOMAIN` in `/opt/larutina/deploy/.env` and run `larutina-deploy --force`.
