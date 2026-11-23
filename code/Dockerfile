# Production image for the VPS deploy (see ../deploy/README.md).
# Build context is this folder. Without a database URL the build uses the
# bundled sample catalog, so the image needs nothing but the source.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# Inlined at build time: absolute URLs for Open Graph images and metadata.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

FROM base AS run
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Image optimizer cache; a named volume keeps it across deploys.
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
