// URLs for sitemap.xml: published products, the taxonomy pages that have
// something to show, published articles and pages. Only used once the site
// is open and the panel allows indexing (IR-01).
import { Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import { getSettings } from '@/server/settings'
import { getCatalog } from './catalog'
import { publishedProductWhere } from './rules'

export type SitemapEntry = { path: string; lastModified?: Date }

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const db = getDb()
  const s = await getSettings()
  const minRelevance = s['catalog.pdpRelevance']
  const [catalog, products, categories, concerns, brands, ingredients, articles, pages] = await Promise.all([
    getCatalog(),
    db.product.findMany({ where: publishedProductWhere(), select: { code: true, updatedAt: true } }),
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, code: true, parentId: true } }),
    db.concern.findMany({ where: { deletedAt: null }, select: { code: true, updatedAt: true } }),
    db.brand.findMany({ where: { deletedAt: null, products: { some: publishedProductWhere() } }, select: { code: true, updatedAt: true } }),
    db.ingredient.findMany({
      where: { deletedAt: null, status: 'ACTIVE', description: { not: null }, products: { some: { product: publishedProductWhere() } } },
      select: { code: true, updatedAt: true },
    }),
    db.article.findMany({ where: { published: { not: Prisma.AnyNull }, deletedAt: null }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { published: { not: Prisma.AnyNull }, deletedAt: null, slug: { not: 'inicio' } }, select: { slug: true, updatedAt: true } }),
  ])
  const usedCategories = new Set(catalog.flatMap((p) => p.categoryPath))
  return [
    { path: '/' },
    { path: '/productos' },
    { path: '/necesidades' },
    { path: '/marcas' },
    { path: '/rutinas' },
    { path: '/diagnostico' },
    ...products.map((p) => ({ path: `/producto/${p.code}`, lastModified: p.updatedAt })),
    ...categories.filter((c) => usedCategories.has(c.code)).map((c) => ({ path: `/categoria/${c.code}` })),
    ...concerns
      .filter((c) => catalog.some((p) => p.concerns.some((x) => x.code === c.code && x.relevance >= minRelevance)))
      .map((c) => ({ path: `/necesidad/${c.code}`, lastModified: c.updatedAt })),
    ...brands.map((b) => ({ path: `/marca/${b.code}`, lastModified: b.updatedAt })),
    ...ingredients.map((i) => ({ path: `/ingrediente/${i.code}`, lastModified: i.updatedAt })),
    ...articles.map((a) => ({ path: `/journal/${a.slug}`, lastModified: a.updatedAt })),
    ...pages.map((p) => ({ path: `/${p.slug}`, lastModified: p.updatedAt })),
  ]
}
