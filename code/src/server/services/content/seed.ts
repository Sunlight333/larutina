import type { Prisma, PrismaClient } from '@prisma/client'
import { audit, type Actor } from '@/server/audit'
import { loadSettings } from '@/server/settings'
import { LEGAL_DOCUMENTS } from './legal'
import { SEED_ANNOUNCEMENTS, SEED_ARTICLE_CATEGORIES, SEED_LEGAL, SEED_PAGES } from './seed-data'

// First content of the site from the content file (seed-data.ts). Creates
// only what is missing and never overwrites: once a page, category, legal
// document or announcement exists (even in the trash), it belongs to the
// panel. Pages are published so the site is not empty; legal documents stay
// as drafts until a lawyer reviews them.
//
// Locally: npx tsx --env-file=.env scripts/seed-content.ts
// In the panel: Home y páginas › Cargar el contenido inicial.

export type SeedReport = { pages: string[]; categories: string[]; legal: string[]; announcements: string[] }

const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

export async function seedContent(db: PrismaClient, actor: Actor = null): Promise<SeedReport> {
  const report: SeedReport = { pages: [], categories: [], legal: [], announcements: [] }

  for (const p of SEED_PAGES) {
    if (await db.page.findUnique({ where: { slug: p.slug }, select: { id: true } })) continue
    await db.$transaction(async (tx) => {
      const doc = asJson(p.doc)
      const page = await tx.page.create({ data: { slug: p.slug, kind: p.kind, title: p.doc.title, draft: doc, published: doc, publishedAt: new Date() } })
      await audit(tx, actor, { action: 'seed', entityType: 'Page', entityId: page.id, label: `${p.doc.title} (/${p.slug === 'inicio' ? '' : p.slug})` })
    })
    report.pages.push(p.slug)
  }

  for (const [position, c] of SEED_ARTICLE_CATEGORIES.entries()) {
    if (await db.articleCategory.findUnique({ where: { slug: c.slug } })) continue
    await db.$transaction(async (tx) => {
      const cat = await tx.articleCategory.create({ data: { ...c, position } })
      await audit(tx, actor, { action: 'seed', entityType: 'ArticleCategory', entityId: cat.id, label: c.name })
    })
    report.categories.push(c.slug)
  }

  for (const d of LEGAL_DOCUMENTS) {
    if (await db.legalDocument.findUnique({ where: { code: d.code } })) continue
    await db.$transaction(async (tx) => {
      const doc = await tx.legalDocument.create({ data: { code: d.code, title: d.title, draftBody: SEED_LEGAL[d.code] ?? '' } })
      await audit(tx, actor, { action: 'seed', entityType: 'LegalDocument', entityId: doc.id, label: d.title })
    })
    report.legal.push(d.code)
  }

  const settings = await loadSettings(db)
  for (const [position, a] of SEED_ANNOUNCEMENTS.entries()) {
    if (await db.announcement.findFirst({ where: { text: a.text } })) continue
    // A message that depends on a value not set yet starts inactive (G-01).
    const active = a.needs === null || Number(settings[a.needs]) > 0
    await db.$transaction(async (tx) => {
      const row = await tx.announcement.create({ data: { text: a.text, position, active } })
      await audit(tx, actor, { action: 'seed', entityType: 'Announcement', entityId: row.id, label: a.text })
    })
    report.announcements.push(a.text)
  }

  return report
}
