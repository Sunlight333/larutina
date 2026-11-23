# LaRutina Beauty

- `code/`: the Next.js app. All npm commands run there (`npm run typecheck`, `npm test`).
- `docs/`: project documents. Kept local; only README files are committed (the repo is public).
- `deploy/`: production deploy. Full guide in `deploy/README.md`.

## Deploying

Production is https://larutinabeauty.com, served from a VPS in São Paulo behind Cloudflare.

- **Deploy directly, not through GitHub:** `deploy/deploy-direct.sh` (needs the SSH alias `larutina-vps`) packs `code/` and `deploy/`, uploads them and runs the server's build, migrations, health check and switch, with automatic rollback on failure. The server no longer polls GitHub, so pushing to `main` does not deploy.
- The script runs `npm run typecheck` and `npm test` first (`--skip-checks` skips them). A build that fails leaves the site on the last good version.
- On the server: `ssh larutina-vps larutina-deploy --status` (also `--rollback`). After a deploy, confirm with `curl -s https://larutinabeauty.com/api/health`.
- Write documentation with the Edit or Write tools, never inside a shell command: backticks in Markdown are command substitution in bash.
- Never write the server password, private keys or server `.env` values into the repo, commits or docs.
