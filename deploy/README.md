# Deploy

Production runs on a VPS in São Paulo (Vultr, Ubuntu 24.04) behind Cloudflare, at **https://larutinabeauty.com**.

```
visitor ─► Cloudflare (DNS, proxy) ─► VPS :443 Caddy (Let's Encrypt) ─► web: Next.js standalone (Docker)
```

| File | Role |
| --- | --- |
| [`../code/Dockerfile`](../code/Dockerfile) | Builds the app into a small Node 24 image (`output: 'standalone'`) |
| [`compose.yaml`](compose.yaml) | The stack: `web` (the app) and `caddy` (HTTPS, `www` → apex redirect) |
| [`Caddyfile`](Caddyfile) | Domain, certificate, reverse proxy |
| [`deploy.sh`](deploy.sh) | Runs on the server: build, switch, health check, automatic rollback |
| [`setup-server.sh`](setup-server.sh) | One-time server provisioning (Docker, firewall, fail2ban, clone, timer) |
| [`systemd/`](systemd) | Timer that deploys `origin/main` within a minute of a push |

On the server: code in `/opt/larutina`, settings in `/opt/larutina/deploy/.env` (git-ignored; `SITE_DOMAIN`, and `TAG` written by the script), deploy state in `/var/lib/larutina`.

The site currently runs **without a database**: it serves the bundled sample catalog and result links carry the answers (see `code/README.md`, "Running without a database"). Adding PostgreSQL is a later step of the real build.

## How to deploy

**Push to `main`. That's it.** The server checks `origin/main` every minute and deploys any new commit, so a deploy works from any machine or chat session that can push to GitHub, with no server access needed. The image is built while the current version keeps serving, and the switch happens only after the new container passes its health check. If it fails, the previous version is restored automatically, and that commit is not retried until a newer one arrives.

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

Remove any other `A`, `AAAA` or `CNAME` records on `@` and `www`. The server has no IPv6 configured, so there is no `AAAA` record.

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

Then point DNS at the new IP as above. To serve another domain, set `SITE_DOMAIN` in `/opt/larutina/deploy/.env` and run `larutina-deploy --force`.
