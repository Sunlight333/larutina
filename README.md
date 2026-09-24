# LaRutina Beauty — demo técnica

A small, finished slice of the proposed store, built to prove three claims from the challenge response:

1. **Diagnosis and routines need a real data model.** Six questions produce a skin type and concerns; the routine is generated from product data (suitability, concern relevance, ingredients, conflicts), and every product comes with a reason built from that data.
2. **The product page is an advisory page.** All 12 blocks of spec §7.2, statically generated.
3. **Next.js pages load fast on mobile.** Measure it on a phone or in PageSpeed Insights.

Routes: `/` · `/diagnostico` · `/diagnostico/resultado/[id]` · `/producto/[slug]` (18) · `/sobre-esta-demo`

Brands, products, prices, reviews and product photos are sample content. The photos are AI-generated (see [Imagery](#imagery)). The whole site is `noindex`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 · Prisma 6 · PostgreSQL (Neon) · Vitest · Node 24 LTS. Versions are pinned exactly in `package.json`.

No auth, cart, payments, analytics or third-party scripts: nothing that is not on the path of the three claims.

## Run it locally

```bash
npm install
cp .env.example .env         # point DATABASE_URL and DIRECT_URL at any Postgres 15+
npm run db:migrate           # applies prisma/migrations
npm run db:seed              # 5 brands, 41 ingredients, 2 conflicts, 18 products
npm run dev
```

Checks:

```bash
npm run typecheck
npm test                     # engine scenarios + invariants over all 3,240 answer combinations
npm run routines             # prints six sample routines to read as a skincare advisor would
```

## Running without a database

If no database URL is set, the site still builds and runs: it reads the same sample catalog from `prisma/seed/data.ts`, and a result link carries the answers as a short code (`/diagnostico/resultado/v1-2-0-01-0-1-1`). The engine is deterministic, so the link shows the same routine on any device. The build log says which mode it is in, and the "about" page and footer describe the deploy accurately in both modes. Connecting PostgreSQL later needs no code change: results are then stored, and the answer-code links keep working.

The database URL is read from `DATABASE_URL`, or from the names Vercel's Neon integration creates (`POSTGRES_PRISMA_URL`, `POSTGRES_URL`; direct: `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`).

## Deploy (Neon + Vercel)

1. **Neon.** Create a project in **AWS São Paulo (`sa-east-1`)**. Copy the pooled connection string (add `&pgbouncer=true&connect_timeout=15`) as `DATABASE_URL` and the direct one as `DIRECT_URL`.
2. **Schema and data, from your machine:** `npx prisma migrate deploy` then `npm run db:seed`, with the Neon URLs in `.env`. Never seed in the build.
3. **Vercel.** Import the repo, set `DATABASE_URL` and `DIRECT_URL`. The build command is already `prisma generate && next build`. `vercel.json` pins functions to `gru1` (São Paulo) so result pages sit next to the database. A clean project name such as `larutina-demo-ravi` makes the link look intentional.
4. Open every route once to warm it, then measure.

Result pages render once on first visit and are then served from cache (`generateStaticParams` returns `[]`); results are immutable, so this is safe and keeps a cold Neon compute off the critical path for shared links.

## Deliberate simplifications versus the real schema

- No `ProductVariant`. Price and size live on the product. The real build splits them.
- Questionnaire lives in code (`src/lib/diagnosis/questions.ts`), not in tables. The real build stores it as data.
- `isIrritant` on ingredient replaces the real rule engine's exclusion effect.
- No routine templates. Routines are generated from step types.

Other decisions worth knowing, all small and all documented in code:

- Tables and columns are mapped to `snake_case` (`@@map` / `@map`), as in the real schema, so the `EXISTS` filter SQL of spec §6.1 runs unchanged.
- The ingredient table has the plan's 18 entries plus 23 base ingredients (preservatives, emollients, UV filters…) so the full INCI lists read like real ones. Base ingredients are never key actives or irritants. `filtros-uv` is marked as a key active, since it is what a sunscreen is about.
- Engine rules beyond the plan, each visible in `src/lib/diagnosis/engine.ts`:
  - A sensitive modifier also applies the *sensible* skin type's `NOT_RECOMMENDED` exclusions.
  - Optional night steps (exfoliant, treatment) only enter the routine when the winning product works on one of the person's concerns.
  - Exfoliants default to "2 o 3 noches por semana"; retinol to "Empezá con 2 noches por semana". In the real build these are rule effects.
  - Skin-type ties resolve *mixta* over *grasa* (the conservative call) and never to *normal*.
- Sample reviews live in `src/content/sample-reviews.ts`, not in a table, are always labelled "Reseñas de ejemplo", and are never marked up as structured data (`Product` JSON-LD has no `aggregateRating`).

## Where things are

```
prisma/schema.prisma              demo subset of spec §4
prisma/seed/                      dataset and editorial copy (Rioplatense Spanish)
src/lib/diagnosis/engine.ts       pure scoring and routine generation (no I/O)
src/lib/diagnosis/questions.ts    questionnaire v1 and weights
src/lib/catalog/coverage.ts       "Aparece en estas rutinas": runs the engine over 60 profiles
src/lib/catalog/pairings.ts       "Combina bien con" and per-product conflicts
src/server/services/              catalog and diagnosis services; app/ holds no business logic
src/app/                          routes
tests/unit/                       engine tests, built on the seed dataset
scripts/images/                   Replicate generation (prompts + runner)
scripts/process-images.mjs        raw generations → public/images + src/content/image-manifest.json
```

## Imagery

Every image was generated for this demo on Replicate, so nothing is copyrighted by a third party and the five fictional brands each have a consistent packaging system.

- **Packshots (18) and editorial stills (2):** `google/nano-banana-pro`, chosen after rendering the same packshot on nano-banana-pro, gpt-image-2, flux-2-max and seedream-4.5. It had the most accurate label typography (accents included) and a truly seamless backdrop, and it accepts reference images, so the hero scenes are composed from the actual packshots.
- **Concern textures (6):** `black-forest-labs/flux-2-max`, the most photographic material detail; no text involved.

```bash
npm run images:generate -- packshots [slug ...]     # needs REPLICATE_API_TOKEN in .env
npm run images:generate -- concerns [slug ...]
npm run images:generate -- editorial [hero|still-life-wide]
npm run images                                      # crop, compress, write the manifest
```

Raw generations go to `images-raw/` (git-ignored, ~100 MB). `npm run images` detects each product against its backdrop and re-frames it to the same scale and baseline, which is what makes 18 separate generations read as one shoot. It also records each photo's backdrop colour and a blur preview, so frames never flash or shift while loading.

**Swapping in real photos:** replace `public/images/products/<slug>.jpg` (or the raw file and rerun `npm run images`). No code changes.

## Performance notes

- One font family, self-hosted and subset: Newsreader at weight 400 with its optical-size axis (56 KB) plus an italic cut to the few words set in italic (6 KB). The full variable family was 273 KB and cost ~0.9 s of LCP on slow 4G.
- All images through `next/image` (AVIF/WebP), explicit `sizes`, the LCP image eager with `fetchPriority="high"`.
- Client components only where interactive: the diagnosis flow, the toast, the two buttons. Disclosures are native `<details>`.
- Local Lighthouse, mobile preset, production build: performance 92–94, accessibility 100, best practices 100, CLS 0. SEO reads 66 only because the demo is deliberately `noindex`. **Use the numbers measured on the deployed URL for the document, not these.**
