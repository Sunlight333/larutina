# Production images for the VPS deploy (see ../deploy/README.md).
# Build context is this folder.
#   target run      the app (Next.js standalone)
#   target migrate  one-shot `prisma migrate deploy`, run by deploy.sh before
#                   the new app container goes live; also runs scripts/ (admin)

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema (only the schema,
# so a new migration does not invalidate this layer).
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --no-audit --no-fund

# Also the tools image: scripts/admin.ts runs here (deploy/admin.sh).
FROM deps AS migrate
COPY . .
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM deps AS build
COPY . .
# Inlined at build time: absolute URLs for Open Graph images and metadata.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
# public/ may be empty, and an empty folder does not survive git or an upload.
RUN mkdir -p public && npm run build

FROM base AS run
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/app/storage
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Image optimizer cache and uploaded media; named volumes keep both across deploys.
RUN mkdir -p .next/cache storage && chown node:node .next/cache storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
