# LaRutina Beauty

The LaRutina platform: storefront, admin panel and catalog pipeline, live at larutinabeauty.com (behind the "Próximamente" page until launch). Production deploys are described in [`../deploy/README.md`](../deploy/README.md).

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Prisma 6 · PostgreSQL 17 · Vitest · Node 24. Versions are pinned exactly in `package.json`.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:dev                                    # PostgreSQL 17 on port 54329 (data in .pgdata/); leave it running
npm run db:deploy                                 # in another terminal: apply prisma/migrations
npx tsx --env-file=.env scripts/seed-content.ts   # starting content: Home, pages, legal drafts
npm run admin -- create you@example.com "Tu nombre" ADMIN   # prints a temporary password
npm run dev
```

`db:dev` needs no Docker or system install: the `embedded-postgres` package ships the server (on Windows it starts through `pg_ctl`). `DEV_PG_PORT` runs it on another port.

Sign in at `/admin` (password, then the authenticator app set up at the first sign-in). The site starts in "Próximamente" mode: visitors see the waitlist, signed-in users see the whole site, and Configuración → Sitio has a preview link for people without an account.

## What is where

```
src/proxy.ts                       site gate: visitors get /proximamente while the site is closed
src/app/(site)/                    storefront routes (layout: header, footer, announcement bar)
src/app/admin/                     panel: login and 2FA, then (panel)/ with every section (nav.ts)
src/app/api/                       search suggestions, cart prices, /api/health, /api/live
src/server/                        all business logic; app/ only renders and calls services
  auth/                            passwords (scrypt), TOTP, database sessions, roles and permissions
  settings/                        every panel setting with its default (registry.ts)
  catalog-import/                  template v1.1: reader, contract, validation, write
  catalog-export/                  the same template out, so a round trip changes nothing
  search/                          SearchProvider and its in-memory index
  services/catalog/                storefront reads: listing, filters, product page, taxonomy pages
  services/admin/catalog/          panel: products, drafts, taxonomies, bulk updates
  services/content/                blocks, pages, journal, legal versions, contact, media, seed
  audit.ts, trash.ts, media.ts     change log, soft-delete registry, uploads
  storage/                         StorageProvider (local volume now, S3-compatible later)
src/components/site/               logo, header, footer, waitlist and maintenance pages
src/components/admin/              generic panel layer: tables, forms, fields
src/components/catalog/, content/  storefront and block renderers
src/assets/brand/                  the emblem and the full logo
src/lib/diagnosis/, src/demo/      the diagnosis engine from the technical demo and its dataset (Phase 3)
scripts/                           dev database, catalog import, content seed, panel users
tests/unit/, tests/integration/    integration tests run against a throwaway PostgreSQL
```

## Rules the code follows

- Money is an integer number of centavos. Prices typed as `18.900` are rejected rather than read as 18.9.
- Every panel page and action checks its permission on the server; every change is written to the audit log in the same transaction.
- Published products and pages are edited as drafts: the site shows the published version, the team previews the draft, "Publicar" applies it. Prices, stock, images and status apply at once.
- Admin-managed records are soft-deleted and can be restored from Papelera.
- Texts from the panel may use copy variables such as `{productos}` or `{envio_gratis_desde}`.
- Every external service goes through an interface owned here (`StorageProvider`, `SearchProvider`, …).

## Catalog

The catalog template v1.1 is the import and export format, in the panel (Catálogo → Importar planilla, Exportar y actualizar en lote) or from the command line:

```bash
npm run catalog:import -- <file.xlsx> --dry-run     # validate and report only
npm run catalog:import -- <file.xlsx>               # import (sample rules, S1)
npm run catalog:import -- <file.xlsx> --stage S5    # full catalog: S5 columns become required
```

- Validation runs over the whole file first; any error rejects the import and nothing is written. Every run is stored with its report.
- New products land in draft; existing ones keep the status set in the panel. Records are matched by code or SKU.
- The `inci` column gives the full ingredient order; unknown INCI names become ingredients marked for review. Flags such as fragrance-free or contains-retinoid are computed from the ingredient families.

## Tests

```bash
npm run typecheck
npm test     # unit, plus integration against a throwaway PostgreSQL (port 54330, or TEST_PG_PORT)
```

The integration tests also run on the client's v1.1 sample when the project documents are present locally (`../docs/`, never committed; or set `CATALOG_SAMPLE`). On Windows, run them from a path with an uppercase drive letter (`D:\…`): with `d:\…` Vitest loads itself twice.
