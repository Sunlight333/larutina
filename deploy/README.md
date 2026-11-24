# Deploy

Production runs on a VPS in São Paulo (Vultr, Ubuntu 24.04) behind Cloudflare, at **https://larutinabeauty.com**, with the management panel at **https://admin.larutinabeauty.com**. Both are the same app; it tells them apart by the host.

```
visitor ─► Cloudflare (DNS, proxy) ─► VPS :443 Caddy (Let's Encrypt) ─► web: Next.js standalone ─► db: PostgreSQL 17
                                                     (all in Docker; db is reachable only from the other containers)
```

| File | Role |
| --- | --- |
| [`../code/Dockerfile`](../code/Dockerfile) | Builds the app into a small Node 24 image (`output: 'standalone'`), and the one-shot migration image |
| [`compose.yaml`](compose.yaml) | The stack: `web` (the app), `db` (PostgreSQL), `caddy` (HTTPS, `www` → apex redirect), and `migrate` (run by the deploy only) |
| [`Caddyfile`](Caddyfile) | Domains (site, `admin.` panel, `www` redirect), certificates, reverse proxy |
| [`deploy.sh`](deploy.sh) | Runs on the server: build, backup, migrations, switch, health check, automatic rollback |
| [`backup.sh`](backup.sh) | Database dumps (nightly, and before every deploy that migrates), nightly media copy, weekly restore rehearsal |
| [`monitor.sh`](monitor.sh) | Every minute: site, app and database health, containers, disk, backup age; alerts on change |
| [`admin.sh`](admin.sh) | `larutina-admin`: create panel users, reset a password or 2FA |
| [`setup-server.sh`](setup-server.sh) | One-time server provisioning (Docker, firewall, fail2ban, clone, timer) |
| [`systemd/`](systemd) | Timers: deploy within a minute of a push; nightly backup; weekly restore check; monitor every minute |

On the server: code in `/opt/larutina`, settings in `/opt/larutina/deploy/.env` (git-ignored, readable by root only), deploy state in `/var/lib/larutina`, backups in `/var/backups/larutina`. The `.env` holds `SITE_DOMAIN`, the live image `TAG`, `POSTGRES_PASSWORD`, which the first deploy creates, and optionally `ALERT_WEBHOOK_URL` (see Monitoring). PostgreSQL takes that password when its data volume is created, so it must never be changed or removed from the file.

Uploaded media (catalog images, contact attachments) live in the `larutina_media` volume, mounted at `/app/storage` in the app container.

## First admin and panel users

The panel is at **https://admin.larutinabeauty.com** (sign-in at `/login`). Old links to `larutinabeauty.com/admin/…` redirect there. Every user signs in with a password and a code from an authenticator app (set up at the first sign-in). The session cookie is set for the whole domain, so a signed-in user is also recognised on the storefront. Create the first user on the server; the rest from the panel (Sistema → Usuarios):

```bash
ssh larutina-vps larutina-admin create <email> "<Nombre>" ADMIN   # prints a temporary password
ssh larutina-vps larutina-admin reset-password <email>
ssh larutina-vps larutina-admin reset-2fa <email>                 # lost phone
ssh larutina-vps larutina-admin list
```

While the site is in "Próximamente" or maintenance mode, visitors see that page and signed-in users see the whole site. To let someone review it without an account, send the preview link from Configuración → Sitio.

## How to deploy

Deploys go straight to the server, not through GitHub. From a workstation with SSH access (host alias `larutina-vps`, see below), run `deploy/deploy-direct.sh` from the repository:

1. It runs the typecheck and the tests (`--skip-checks` skips them).
2. It packs `code/` and `deploy/` as they are on disk. Git's ignore rules keep out `.env`, `node_modules`, build output and local data, and `docs/` never goes.
3. It uploads the archive and runs the uploaded `deploy.sh --direct` on the server.

On the server, the new image is built while the current version keeps serving. Then come a backup (once the database holds data), the database migrations (`code/prisma/migrations`), and any starting content still missing (Home, pages, legal drafts, announcements), which never overwrites what was changed in the panel. The switch happens only after the new container passes its health check. If the build, the migrations or the health check fail, the previous version keeps serving or is restored automatically. New or changed timers in `deploy/systemd` are installed in the same run.

The timer that used to deploy `origin/main` from GitHub stays off, so a push never replaces what was deployed. `larutina-deploy` without options still deploys `origin/main` by hand if ever needed.

```bash
deploy/deploy-direct.sh                        # check, upload, deploy
ssh larutina-vps larutina-deploy --status      # what is live, recent deploys, backups, containers
ssh larutina-vps larutina-deploy --rollback    # back to the previous deploy
ssh larutina-vps 'cd /opt/larutina/deploy && docker compose logs --tail 100 web'
```

A deploy takes about three to five minutes, mostly `npm ci` and `next build`. While containers are swapped, Caddy holds requests for up to 30 seconds rather than failing them.

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

`monitor.sh` runs every minute on the server. It checks the site through Caddy (`/api/live`), the panel's sign-in page on `admin.` (which also catches an expired panel certificate), the app and database (`/api/health`), that every container is running and healthy, disk use under 85%, a nightly backup in the last 48 hours, and a successful restore rehearsal in the last 8 days. Each problem is reported once when it starts (after two failed checks in a row, so a deploy swap does not page) and once when it clears. The app also reports every unhandled server error.

Alerts go to `ALERT_WEBHOOK_URL` in `/opt/larutina/deploy/.env`: any URL that accepts a JSON POST with a `text` or `content` field (a Slack or Discord incoming webhook works as is). After adding it, run `larutina-deploy --force` so the app picks it up, and `/opt/larutina/deploy/monitor.sh --test` to see an alert arrive. Without it, problems are only written to the journal (`journalctl -u larutina-monitor`).

For an outside view as well (the server cannot report its own outage), point any uptime service at `https://larutinabeauty.com/api/health`.

## Incidents

A blocking incident is one that stops visitors from browsing or buying, stops payments from confirming, or exposes data. During the warranty the first response is within 2 hours (Anexo §15). Anything else is handled in the next working day.

1. **Acknowledge.** Reply on the incident channel that it is being looked at, with the time.
2. **Look.** `ssh larutina-vps larutina-deploy --status` (live version, recent deploys, containers, backups), `curl -s https://larutinabeauty.com/api/health`, and the logs: `ssh larutina-vps "cd /opt/larutina/deploy && docker compose logs --since 30m web"`.
3. **Contain.**
   - A deploy caused it: `ssh larutina-vps larutina-deploy --rollback`.
   - The site must not be reached while it is fixed: switch on "Modo mantenimiento" in the panel (Configuración). The team still sees the site.
   - A payment or shipping provider is down: the site keeps selling on its fallbacks; note the time window, since orders in it may need checking by hand.
   - Data looks wrong: stop, take a backup (`/opt/larutina/deploy/backup.sh`), and only then repair. Restoring a backup is the last resort, because it loses everything written after it.
4. **Fix and verify.** Deploy the fix, check `/api/health`, and walk the affected journey on the live site.
5. **Report.** Within one working day, send LaRutina what happened, the time window, what was affected (orders, payments, customers), what was done, and what prevents it from happening again.

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
| A | `admin` | server IP | see steps |

Remove any other `A`, `AAAA` or `CNAME` records on `@`, `www` and `admin`. No `AAAA` record is needed: once proxied, Cloudflare serves visitors over IPv6 by itself and reaches the server over IPv4.

1. Create the records as **DNS only** (grey cloud). Caddy gets a Let's Encrypt certificate for each name within a minute or two of it resolving to the server.
2. Once `https://larutinabeauty.com` and `https://admin.larutinabeauty.com/login` load with a valid certificate, switch the records to **Proxied** (orange cloud).
3. **SSL/TLS → Overview:** encryption mode **Full (strict)**. Not Flexible: that causes a redirect loop.
4. **SSL/TLS → Edge Certificates:** leave **Always Use HTTPS** off. Caddy already redirects HTTP to HTTPS, and keeping port 80 reachable lets it renew the certificate through the proxy with no extra rules. If it must be on, add a rule that exempts `/.well-known/acme-challenge/*` from it.
5. Don't put bot challenges in front of `/.well-known/acme-challenge/*` (Bot Fight Mode, "Under Attack", WAF rules); they block renewals.

## Rebuilding the server from scratch

On a fresh Ubuntu 24.04 VPS, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Sunlight333/larutina/main/deploy/setup-server.sh | bash
larutina-deploy
```

The first deploy creates an empty database with a new password. To move the data, copy a backup from the old server and restore it as above. Then point DNS at the new IP as above. To serve another domain, set `SITE_DOMAIN` in `/opt/larutina/deploy/.env` and run `larutina-deploy --force`. The panel then moves to `admin.` on that domain, which needs its own DNS record.
