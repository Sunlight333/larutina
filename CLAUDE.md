# LaRutina Beauty

- `code/`: the Next.js app. All npm commands run there (`npm run typecheck`, `npm test`).
- `docs/`: project documents. Kept local; only README files are committed (the repo is public).
- `deploy/`: production deploy. Full guide in `deploy/README.md`.

## Deploying

Production is https://larutinabeauty.com, served from a VPS in São Paulo behind Cloudflare.

- **Deploying means pushing to `main`.** The server polls `origin/main` every minute, builds, health-checks and switches, and rolls back automatically on failure. No server credentials are needed for this.
- Before pushing, run `npm run typecheck` and `npm test` in `code/`. A commit that fails to build is skipped, and the site keeps running the last good version.
- When the SSH alias `larutina-vps` is configured on this machine (`~/.ssh/config`), you can deploy immediately and see the result: `ssh larutina-vps larutina-deploy`. Also `--status`, `--rollback`, `--force`. After a deploy, confirm with `curl -sI https://larutinabeauty.com`.
- Never write the server password, private keys or server `.env` values into the repo, commits or docs.
