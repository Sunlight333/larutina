import { Prisma, type Page, type PageKind, type PrismaClient } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import { normalizePageDoc, type PageDoc } from './blocks'
import { ContentError } from './errors'
import { stableStringify } from './fields'

// Block pages (CMS-01) with the draft and published split of ADM-02: the panel
// edits `draft`, "Publicar" copies it to `published`, and the site only reads
// `published` (or the draft, for the team, in the preview).

export const HOME_SLUG = 'inicio'

/** Top-level routes of the site and words kept for them: a page cannot take these slugs. */
export const RESERVED_SLUGS = [
  'productos', 'producto', 'marcas', 'marca', 'categoria', 'necesidad', 'necesidades', 'ingrediente', 'ingredientes', 'buscar', 'carrito',
  'journal', 'legales', 'contacto', 'diagnostico', 'rutinas', 'arrepentimiento', 'admin', 'api', 'media', 'vista-previa', HOME_SLUG,
  'sitemap.xml', 'robots.txt',
  'cuenta', 'resenas',
] as const

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugProblem(slug: string): string | null {
  if (!slug) return 'Escribí la dirección de la página.'
  if (slug.length > 80) return 'Hasta 80 caracteres.'
  if (!SLUG_RE.test(slug)) return 'Solo minúsculas sin tildes, números y guiones, como "cuidado-de-verano".'
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return `"${slug}" ya es una sección del sitio. Elegí otra dirección.`
  return null
}

/** "Cuidado de verano" → "cuidado-de-verano". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export const PAGE_KIND_LABELS: Record<PageKind, string> = { HOME: 'Home', LANDING: 'Landing', INSTITUTIONAL: 'Institucional', HELP: 'Ayuda' }

export const draftOf = (p: Pick<Page, 'draft' | 'title'>) => normalizePageDoc(p.draft, p.title)
export const publishedOf = (p: Pick<Page, 'published' | 'title'>) => (p.published ? normalizePageDoc(p.published, p.title) : null)

export function pageStatus(p: Pick<Page, 'draft' | 'published' | 'title'>): 'draft' | 'published' | 'changes' {
  if (!p.published) return 'draft'
  return stableStringify(draftOf(p)) === stableStringify(publishedOf(p)) ? 'published' : 'changes'
}

const asJson = (doc: PageDoc) => JSON.parse(JSON.stringify(doc)) as Prisma.InputJsonValue

export async function listPages(db: PrismaClient) {
  const pages = await db.page.findMany({ where: { deletedAt: null }, orderBy: [{ kind: 'asc' }, { title: 'asc' }] })
  // Home first, then landings, institutional and help pages.
  return pages.sort((a, b) => Number(b.slug === HOME_SLUG) - Number(a.slug === HOME_SLUG))
}

export async function createPage(db: PrismaClient, actor: Actor, input: { title: string; slug: string; kind: Exclude<PageKind, 'HOME'> }, initial?: Partial<PageDoc>) {
  const problem = slugProblem(input.slug)
  if (problem) throw new ContentError(problem, 'slug')
  if (!input.title.trim()) throw new ContentError('Escribí el título.', 'title')
  const existing = await db.page.findUnique({ where: { slug: input.slug } })
  if (existing) throw new ContentError(existing.deletedAt ? 'Hay una página con esa dirección en la papelera. Restaurala o elegí otra dirección.' : 'Ya hay una página con esa dirección.', 'slug')
  const doc: PageDoc = { title: input.title.trim(), seoTitle: '', seoDescription: '', blocks: [], ...initial }
  return db.$transaction(async (tx) => {
    const page = await tx.page.create({ data: { slug: input.slug, kind: input.kind, title: doc.title, draft: asJson(doc) } })
    await audit(tx, actor, { action: 'create', entityType: 'Page', entityId: page.id, label: `${doc.title} (/${page.slug})`, after: { slug: page.slug, kind: page.kind } })
    return page
  })
}

/** Saves the draft; the site does not change until it is published. */
export async function savePageDraft(db: PrismaClient, actor: Actor, id: string, doc: PageDoc) {
  return db.$transaction(async (tx) => {
    const page = await tx.page.findUnique({ where: { id } })
    if (!page || page.deletedAt) throw new ContentError('La página no existe o está en la papelera.')
    const before = draftOf(page)
    const diff = changedFields(before as unknown as Record<string, unknown>, doc as unknown as Record<string, unknown>)
    if (!diff.changed) return { page, changed: false }
    const updated = await tx.page.update({ where: { id }, data: { title: doc.title, draft: asJson(doc) } })
    await audit(tx, actor, { action: 'update', entityType: 'Page', entityId: id, label: `${doc.title} (/${page.slug})`, before: diff.before, after: diff.after })
    return { page: updated, changed: true }
  })
}

/** "Publicar": the draft becomes what the site shows. */
export async function publishPage(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const page = await tx.page.findUnique({ where: { id } })
    if (!page || page.deletedAt) throw new ContentError('La página no existe o está en la papelera.')
    const doc = draftOf(page)
    const previous = publishedOf(page)
    const updated = await tx.page.update({ where: { id }, data: { published: asJson(doc), publishedAt: new Date() } })
    await audit(tx, actor, {
      action: 'publish',
      entityType: 'Page',
      entityId: id,
      label: `${doc.title} (/${page.slug})`,
      before: previous ? { blocks: previous.blocks.length, title: previous.title } : null,
      after: { blocks: doc.blocks.length, title: doc.title },
    })
    return updated
  })
}

/** Takes a page off the site (not the Home), keeping its draft. */
export async function unpublishPage(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const page = await tx.page.findUniqueOrThrow({ where: { id } })
    if (page.slug === HOME_SLUG) throw new ContentError('La Home no se puede despublicar.')
    await tx.page.update({ where: { id }, data: { published: Prisma.DbNull, publishedAt: null } })
    await audit(tx, actor, { action: 'unpublish', entityType: 'Page', entityId: id, label: `${page.title} (/${page.slug})` })
  })
}

/** To the trash bin (/admin/papelera), from where it can be restored. */
export async function deletePage(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const page = await tx.page.findUniqueOrThrow({ where: { id } })
    if (page.slug === HOME_SLUG) throw new ContentError('La Home no se puede borrar.')
    await tx.page.update({ where: { id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Page', entityId: id, label: `${page.title} (/${page.slug})` })
  })
}

/**
 * What the site shows at a slug: the published document, or with `preview`
 * the draft (the team only; the caller checks). Null when there is nothing.
 */
export async function getPageForSite(db: PrismaClient, slug: string, opts: { preview?: boolean; kinds?: PageKind[] } = {}) {
  const page = await db.page.findUnique({ where: { slug } })
  if (!page || page.deletedAt) return null
  if (opts.kinds && !opts.kinds.includes(page.kind)) return null
  const doc = opts.preview ? draftOf(page) : publishedOf(page)
  if (!doc) return null
  return { page, doc, preview: !!opts.preview }
}

