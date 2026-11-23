# LaRutina Beauty

| Folder | Contents |
| --- | --- |
| [`code/`](code) | The Next.js demo application: source, database schema, scripts and tests. See [`code/README.md`](code/README.md) for setup, commands and deployment |
| [`docs/`](docs) | Requirements, specifications and project documents. See [`docs/README.md`](docs/README.md) |

## Working on the app

All app commands run from `code/`:

```bash
cd code
npm install
npm run dev
```

## Deploying

Production runs at **https://larutinabeauty.com** on a VPS in São Paulo behind Cloudflare. Pushing to `main` deploys it within a few minutes. See [`deploy/README.md`](deploy/README.md) for how it works, manual deploys, rollback and DNS.

The app can still be deployed on Vercel too: the Vercel project's **Root Directory** must be set to `code` (Project Settings → Build and Deployment).
