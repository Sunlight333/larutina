# LaRutina Beauty

The platform build (Phase 1 onwards) and, until the Phase 1 storefront replaces it, the technical demo that is live on larutinabeauty.com.

- **Platform:** PostgreSQL schema for the v1.1 catalog (`prisma/schema.prisma`) and the catalog import (`src/server/catalog-import/`). See [Platform](#platform).
- **Demo storefront:** the pages under `src/app/`, reading the sample dataset bundled in `src/demo/data.ts`. It needs no database. See below from [Stack](#stack).

## Platform

### Local setup

```bash
npm install
cp .env.example .env
npm run db:dev               # PostgreSQL 17 on port 54329, data in .pgdata/; leave it running
npm run db:deploy            # in another terminal: apply prisma/migrations
```

`db:dev` needs no Docker or system install: the `embedded-postgres` package ships the server. On Windows it starts through `pg_ctl`, so it also works from an administrator account.

### Catalog import

The catalog template v1.1 is the import and export format. Validation runs over the whole file first; any error rejects the import and nothing is written. Every run is stored as an `ImportJob` with its report.

```bash
npm run catalog:import -- <file.xlsx> --dry-run     # validate and report only
npm run catalog:import -- <file.xlsx>               # import (sample rules, S1)
npm run catalog:import -- <file.xlsx> --stage S5    # full catalog: S5 columns become required
```

- New products and routines land in draft. Existing ones keep the status set in the panel.
- Records are matched by code or SKU. Re-importing a file updates and creates nothing new.
- The `inci` column gives the full ingredient order. Unknown INCI names become ingredients marked for review. `Prod_Ingredientes` marks the star ingredients.
- Flags such as fragrance-free or contains-retinoid are computed from the ingredient families. A loaded `sin_fragancia` that contradicts the INCI is reported.
- Prices are stored in centavos. A price written as `18.900` is rejected rather than read as 18.9.

### Tests

```bash
npm test     # unit tests, plus integration tests against a throwaway PostgreSQL (port 54330)
```

The integration tests also import the client's v1.1 sample when the project documents are present locally (`../docs/`, never committed).

## Demo storefront

A small, finished slice of the proposed store, built to prove three claims from the challenge response:

1. **Diagnosis and routines need a real data model.** Six questions produce a skin type and concerns; the routine is generated from product data (suitability, concern relevance, ingredients, conflicts), and every product comes with a reason built from that data.
2. **The product page is an advisory page.** All 12 blocks of spec §7.2, statically generated.
3. **Next.js pages load fast on mobile.** Measure it on a phone or in PageSpeed Insights.

Routes: `/` · `/productos` (filterable catalog) · `/diagnostico` · `/diagnostico/resultado/[id]` · `/producto/[slug]` (18) · `/sobre-esta-demo`

Brands, products, prices and reviews are sample content, and every image, models included, is AI-generated (see [Imagery](#imagery)). The whole site is `noindex`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 · Prisma 6 · PostgreSQL 17 · Vitest · Node 24 LTS. Versions are pinned exactly in `package.json`.

The demo storefront has no auth, cart, payments, analytics or third-party scripts: nothing that is not on the path of the three claims.

```bash
npm run dev
npm run routines             # prints six sample routines to read as a skincare advisor would
```

The demo reads its catalog from `src/demo/data.ts` and never touches the database. A result link carries the answers as a short code (`/diagnostico/resultado/v1-2-0-01-0-1-1`); the engine is deterministic, so the link shows the same routine on any device. Production deploys are described in `../deploy/README.md`.

## Deliberate simplifications versus the real schema

- No `ProductVariant`. Price and size live on the product. The real build splits them.
- Questionnaire lives in code (`src/lib/diagnosis/questions.ts`), not in tables. The real build stores it as data.
- `isIrritant` on ingredient replaces the real rule engine's exclusion effect.
- No routine templates. Routines are generated from step types.

Other decisions worth knowing, all small and all documented in code:

- The ingredient table has the plan's 18 entries plus 23 base ingredients (preservatives, emollients, UV filters…) so the full INCI lists read like real ones. Base ingredients are never key actives or irritants. `filtros-uv` is marked as a key active, since it is what a sunscreen is about.
- Engine rules beyond the plan, each visible in `src/lib/diagnosis/engine.ts`:
  - A sensitive modifier also applies the *sensible* skin type's `NOT_RECOMMENDED` exclusions.
  - Optional night steps (exfoliant, treatment) only enter the routine when the winning product works on one of the person's concerns.
  - Exfoliants default to "2 o 3 noches por semana"; retinol to "Empezá con 2 noches por semana". In the real build these are rule effects.
  - Skin-type ties resolve *mixta* over *grasa* (the conservative call) and never to *normal*.
- Sample reviews live in `src/content/sample-reviews.ts`, not in a table, are always labelled "Reseñas de ejemplo", and are never marked up as structured data (`Product` JSON-LD has no `aggregateRating`).

## Where things are

```
prisma/schema.prisma              platform schema: catalog v1.1
src/server/catalog-import/        catalog import: workbook reader, v1.1 contract, validation, write
scripts/dev-db.ts                 local PostgreSQL (npm run db:dev)
scripts/catalog-import.ts         import from the command line (npm run catalog:import)
tests/integration/                tests against a throwaway PostgreSQL
src/demo/data.ts                  demo dataset and editorial copy (Rioplatense Spanish)
src/lib/diagnosis/engine.ts       pure scoring and routine generation (no I/O)
src/lib/diagnosis/questions.ts    questionnaire v1 and weights
src/lib/catalog/coverage.ts       "Aparece en estas rutinas": runs the engine over 60 profiles
src/lib/catalog/pairings.ts       "Combina bien con" and per-product conflicts
src/server/services/catalog.ts    demo catalog reads, including the filtered listing
src/server/services/              catalog and diagnosis services; app/ holds no business logic
src/app/                          routes
tests/unit/                       engine tests on the demo dataset; catalog import validation
scripts/images/                   Replicate generation (prompts, runner, label retouching)
scripts/process-images.mjs        raw generations → public/images + src/content/image-manifest.json
```

## Imagery

Every image was generated for this demo on Replicate, so nothing is copyrighted by a third party. The models in the campaign images are AI-generated too: they are not real people, and the about page says so.

- **Packshots (18):** `google/nano-banana-pro`, chosen after rendering the same packshot on nano-banana-pro, gpt-image-2, flux-2-max and seedream-4.5: the most accurate label typography (accents included) and a truly seamless backdrop. Each fictional brand has its own packaging system. Used only where a product is displayed.
- **The campaign (14):** everything outside the product displays is one shoot: the same sunlit Buenos Aires apartment, the same warm palette and light, and the same three models (Sofía, Valentina and Maia, women in their twenties), so the images read as one advertising campaign rather than a collection. `google/nano-banana-pro` again, with the real packshots passed as reference images so every product in a photo is the catalog's. The first hero established the cast; a sheet of their faces (`images-raw/cast.png`) goes into every later generation to keep them the same women. Every image is an "after": healthy, glowing skin, the result the products promise.
  - Three group campaigns rotate in the home hero, each with three products; hotspots on the products link to them.
  - Ten portraits, one model and one product each: concerns, morning and night, the product showcase, the diagnosis, and the product page's "en uso".
  - A still life of five products on the set, for the brand band and the about page.

```bash
npm run images:generate -- packshots [slug ...]     # needs REPLICATE_API_TOKEN in .env
npm run images:generate -- campaigns [name ...]     # prompts, set and cast in scripts/images/prompts.mjs
node --env-file=.env scripts/images/retouch-labels.mjs scripts/images/retouch/hero-1.json   # fix garbled small labels
npm run images                                      # crop, compress, hash, write the manifest
```

Small labels sometimes come out garbled in group photos, and an edit of the whole image tends to fix one label while scrambling another. `retouch-labels.mjs` edits an enlarged crop instead, registers it back onto the original and blends in only the label patches; the configs used for the heroes are in `scripts/images/retouch/`.

Raw generations go to `images-raw/` (git-ignored). `npm run images` re-frames every packshot to the same scale and baseline (it detects the product against its backdrop), compresses everything, cuts a 4:5 phone crop of each hero (phones download that instead of the wide image), and names each file with a content hash (`hero-1.572d23f5.jpg`), so a changed image always gets a new URL and no cache can serve the old one. It also records each packshot's backdrop colour and a blur preview for every image, so frames never flash or shift while loading.

**Swapping in real photos:** put the client's files in `images-raw/products/<slug>.png` and rerun `npm run images`. No code changes.

## Performance notes

- One font family, self-hosted and subset: Newsreader at weight 400 with its optical-size axis (56 KB) plus an italic cut to the few words set in italic (6 KB). The full variable family was 273 KB and cost ~0.9 s of LCP on slow 4G.
- All images through `next/image` (AVIF/WebP), explicit `sizes`, the LCP image eager with `fetchPriority="high"`. The hero serves a 4:5 crop to phones through `<picture>` (26 KB instead of a 1920px wide image), and the second and third campaigns mount only after the page has loaded, so they never compete with the first.
- Below-the-fold home sections use `content-visibility: auto`, so the first paint only pays for the hero's style and layout. (A screenshot tool that captures the full page without scrolling shows those sections blank; scrolling renders them.)
- Client components only where interactive: the diagnosis flow, the toast, the two buttons. Disclosures are native `<details>`.
- Local Lighthouse, mobile preset, production build: performance 92–96 on the home page, accessibility 100, best practices 100, CLS 0. SEO reads 66 only because the demo is deliberately `noindex`. **Use the numbers measured on the deployed URL for the document, not these.**
