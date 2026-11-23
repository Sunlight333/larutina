import { Prisma, type Article, type PrismaClient } from '@prisma/client'
import { audit, changedFields, type Actor } from '@/server/audit'
import { ContentError } from './errors'
import { normalizeFields, readFields, stableStringify, validateFields, type FieldDef, type ImageReader } from './fields'
import { imageReaders } from './form'
import { SLUG_RE, slugify } from './pages'

// The journal (CMS-02): articles with category, author, "Revisado por",
// embedded products and routines, and related articles. Same draft and
// published split as pages (ADM-02): the site reads `published` only.

export const ARTICLE_FIELDS = [
  { kind: 'text', name: 'title', label: 'Título (H1)', required: true, max: 160 },
  { kind: 'textarea', name: 'excerpt', label: 'Bajada', help: 'Una oración. También es la descripción para Google.', rows: 2, max: 300 },
  { kind: 'image', name: 'coverImage', label: 'Portada', help: 'Horizontal, 1600 × 900.' },
  { kind: 'text', name: 'coverAlt', label: 'Texto alternativo de la portada', max: 250 },
  { kind: 'text', name: 'author', label: 'Autor', help: 'Vacío: Larutina.', max: 80 },
  { kind: 'text', name: 'reviewedBy', label: 'Revisado por', help: 'Nombre y profesión, solo si una profesional lo revisó. Por ejemplo: Dra. Ana Pérez, dermatóloga.', max: 120 },
  { kind: 'markdown', name: 'body', label: 'Cuerpo', required: true, rows: 22 },
  { kind: 'codes', name: 'productCodes', label: 'Productos insertados (códigos)', help: 'Se muestran después del texto. Uno por línea.', max: 8 },
  { kind: 'codes', name: 'routineCodes', label: 'Rutinas insertadas (códigos)', max: 4 },
  { kind: 'codes', name: 'relatedSlugs', label: 'Artículos relacionados (direcciones)', help: 'Vacío: los últimos de la misma categoría.', max: 3 },
  { kind: 'text', name: 'seoTitle', label: 'Título para Google', help: 'Vacío: el título. Se le suma " · Journal Larutina".', max: 70 },
  { kind: 'textarea', name: 'seoDescription', label: 'Descripción para Google', help: 'Vacío: la bajada. Hasta 155 caracteres.', rows: 2, max: 155 },
] satisfies FieldDef[]

export type ArticleDoc = {
  title: string
  excerpt: string
  coverImage: string
  coverAlt: string
  author: string
  reviewedBy: string
  body: string
  productCodes: string[]
  routineCodes: string[]
  relatedSlugs: string[]
  seoTitle: string
  seoDescription: string
  categorySlug: string
}
/** The published copy also records when this version went out (dateModified). */
export type PublishedArticleDoc = ArticleDoc & { versionAt: string }

export function normalizeArticleDoc(raw: unknown, fallbackTitle = ''): ArticleDoc {
  const d = (raw ?? {}) as Record<string, unknown>
  const data = normalizeFields(ARTICLE_FIELDS, d) as unknown as Omit<ArticleDoc, 'categorySlug'>
  return { ...data, title: data.title || fallbackTitle, categorySlug: typeof d.categorySlug === 'string' ? d.categorySlug : '' }
}

export const articleDraft = (a: Pick<Article, 'draft' | 'title'>) => normalizeArticleDoc(a.draft, a.title)
export function articlePublished(a: Pick<Article, 'published' | 'title'>): PublishedArticleDoc | null {
  if (!a.published) return null
  const p = a.published as Record<string, unknown>
  return { ...normalizeArticleDoc(p, a.title), versionAt: typeof p.versionAt === 'string' ? p.versionAt : new Date(0).toISOString() }
}

export function articleStatus(a: Pick<Article, 'draft' | 'published' | 'title'>): 'draft' | 'published' | 'changes' {
  const pub = articlePublished(a)
  if (!pub) return 'draft'
  const { versionAt: _v, ...rest } = pub
  return stableStringify(rest) === stableStringify(articleDraft(a)) ? 'published' : 'changes'
}

const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

/** Reads the article editor; checks everything before uploading the cover. */
export async function readArticleForm(db: PrismaClient, form: FormData, categories: string[], actorEmail?: string) {
  const readers = imageReaders(db, form, actorEmail)
  const read = async (reader: ImageReader) => {
    const errors: Record<string, string> = {}
    const data = (await readFields(form, ARTICLE_FIELDS, '', reader, errors)) as unknown as Omit<ArticleDoc, 'categorySlug'>
    validateFields(ARTICLE_FIELDS, data, '', errors)
    const categorySlug = String(form.get('categorySlug') ?? '')
    if (categorySlug && !categories.includes(categorySlug)) errors.categorySlug = 'Elegí una categoría de la lista.'
    const bad = data.relatedSlugs.find((s) => !SLUG_RE.test(s))
    if (bad) errors.relatedSlugs = `"${bad}" no es una dirección válida.`
    return { doc: { ...data, categorySlug } as ArticleDoc, errors }
  }
  const check = await read(readers.dry)
  if (Object.keys(check.errors).length) return check
  return read(readers.real)
}

export function articleSlugProblem(slug: string): string | null {
  if (!slug) return 'Escribí la dirección.'
  if (slug.length > 100) return 'Hasta 100 caracteres.'
  return SLUG_RE.test(slug) ? null : 'Solo minúsculas sin tildes, números y guiones.'
}

export async function createArticle(db: PrismaClient, actor: Actor, input: { title: string; slug?: string }) {
  const title = input.title.trim()
  if (!title) throw new ContentError('Escribí el título.', 'title')
  const slug = input.slug?.trim() || slugify(title)
  const problem = articleSlugProblem(slug)
  if (problem) throw new ContentError(problem, 'slug')
  const existing = await db.article.findUnique({ where: { slug } })
  if (existing) throw new ContentError(existing.deletedAt ? 'Hay un artículo con esa dirección en la papelera.' : 'Ya hay un artículo con esa dirección.', 'slug')
  const doc: ArticleDoc = { ...normalizeArticleDoc({}), title }
  return db.$transaction(async (tx) => {
    const a = await tx.article.create({ data: { slug, title, draft: asJson(doc) } })
    await audit(tx, actor, { action: 'create', entityType: 'Article', entityId: a.id, label: title, after: { slug } })
    return a
  })
}

/** Saves the draft. The address can change only while the article was never published, so links never break. */
export async function saveArticleDraft(db: PrismaClient, actor: Actor, id: string, doc: ArticleDoc, newSlug?: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.article.findUnique({ where: { id } })
    if (!a || a.deletedAt) throw new ContentError('El artículo no existe o está en la papelera.')
    let slug = a.slug
    if (newSlug && newSlug !== a.slug) {
      if (a.publishedAt) throw new ContentError('La dirección no cambia después de publicar, para no romper links.', 'slug')
      const problem = articleSlugProblem(newSlug)
      if (problem) throw new ContentError(problem, 'slug')
      if (await tx.article.findUnique({ where: { slug: newSlug } })) throw new ContentError('Ya hay un artículo con esa dirección.', 'slug')
      slug = newSlug
    }
    const before = { ...articleDraft(a), slug: a.slug }
    const diff = changedFields(before as unknown as Record<string, unknown>, { ...doc, slug } as unknown as Record<string, unknown>)
    if (!diff.changed) return false
    await tx.article.update({ where: { id }, data: { slug, title: doc.title, draft: asJson(doc) } })
    await audit(tx, actor, { action: 'update', entityType: 'Article', entityId: id, label: doc.title, before: diff.before, after: diff.after })
    return true
  })
}

export async function publishArticle(db: PrismaClient, actor: Actor, id: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const a = await tx.article.findUnique({ where: { id } })
    if (!a || a.deletedAt) throw new ContentError('El artículo no existe o está en la papelera.')
    const doc = articleDraft(a)
    if (!doc.body.trim()) throw new ContentError('Escribí el cuerpo antes de publicar.', 'body')
    const published: PublishedArticleDoc = { ...doc, versionAt: now.toISOString() }
    // publishedAt is the first publication (datePublished); versionAt, the latest (dateModified).
    const updated = await tx.article.update({ where: { id }, data: { published: asJson(published), publishedAt: a.publishedAt ?? now } })
    await audit(tx, actor, { action: 'publish', entityType: 'Article', entityId: id, label: doc.title, after: { slug: a.slug, versionAt: published.versionAt } })
    return updated
  })
}

export async function unpublishArticle(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } })
    await tx.article.update({ where: { id }, data: { published: Prisma.DbNull } })
    await audit(tx, actor, { action: 'unpublish', entityType: 'Article', entityId: id, label: a.title })
  })
}

export async function deleteArticle(db: PrismaClient, actor: Actor, id: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } })
    await tx.article.update({ where: { id }, data: { deletedAt: new Date() } })
    await audit(tx, actor, { action: 'delete', entityType: 'Article', entityId: id, label: a.title })
  })
}

// ------------------------------------------------------------------ site ----

export type ArticleCard = { slug: string; doc: PublishedArticleDoc; publishedAt: Date }

const livePublished = { deletedAt: null, NOT: { published: { equals: Prisma.DbNull } } } satisfies Prisma.ArticleWhereInput

/** Published articles, newest first; optionally of one category. */
export async function listPublishedArticles(db: PrismaClient, opts: { categorySlug?: string; take?: number; skip?: number; exclude?: string } = {}) {
  const where: Prisma.ArticleWhereInput = {
    ...livePublished,
    ...(opts.categorySlug ? { published: { path: ['categorySlug'], equals: opts.categorySlug } } : {}),
    ...(opts.exclude ? { slug: { not: opts.exclude } } : {}),
  }
  const [rows, total] = await Promise.all([
    db.article.findMany({ where, orderBy: { publishedAt: 'desc' }, take: opts.take ?? 24, skip: opts.skip ?? 0 }),
    db.article.count({ where }),
  ])
  return { total, articles: rows.map((r) => ({ slug: r.slug, doc: articlePublished(r)!, publishedAt: r.publishedAt ?? r.createdAt })) satisfies ArticleCard[] }
}

/** The published article, or with `preview` the draft (the caller checks it is the team). */
export async function getArticleForSite(db: PrismaClient, slug: string, preview = false) {
  const a = await db.article.findUnique({ where: { slug } })
  if (!a || a.deletedAt) return null
  if (preview) return { article: a, doc: { ...articleDraft(a), versionAt: new Date().toISOString() } as PublishedArticleDoc, preview: true }
  const doc = articlePublished(a)
  return doc ? { article: a, doc, preview: false } : null
}

/** The chosen related articles, or the latest of the same category. */
export async function relatedArticles(db: PrismaClient, slug: string, doc: ArticleDoc, limit = 3): Promise<ArticleCard[]> {
  if (doc.relatedSlugs.length) {
    const rows = await db.article.findMany({ where: { ...livePublished, slug: { in: doc.relatedSlugs.filter((s) => s !== slug) } } })
    return doc.relatedSlugs.flatMap((s) => rows.filter((r) => r.slug === s)).map((r) => ({ slug: r.slug, doc: articlePublished(r)!, publishedAt: r.publishedAt ?? r.createdAt }))
  }
  if (!doc.categorySlug) return []
  return (await listPublishedArticles(db, { categorySlug: doc.categorySlug, take: limit, exclude: slug })).articles
}

// ------------------------------------------------------------ categories ----

export async function createCategory(db: PrismaClient, actor: Actor, input: { name: string; slug?: string; position?: number }) {
  const name = input.name.trim()
  if (!name) throw new ContentError('Escribí el nombre.', 'name')
  const slug = input.slug?.trim() || slugify(name)
  if (!SLUG_RE.test(slug)) throw new ContentError('Solo minúsculas sin tildes, números y guiones.', 'slug')
  if (await db.articleCategory.findUnique({ where: { slug } })) throw new ContentError('Ya hay una categoría con esa dirección.', 'slug')
  const position = input.position ?? (await db.articleCategory.count())
  return db.$transaction(async (tx) => {
    const c = await tx.articleCategory.create({ data: { name, slug, position } })
    await audit(tx, actor, { action: 'create', entityType: 'ArticleCategory', entityId: c.id, label: name, after: { slug, position } })
    return c
  })
}

export async function updateCategory(db: PrismaClient, actor: Actor, id: string, input: { name: string; position: number }) {
  const name = input.name.trim()
  if (!name) throw new ContentError('Escribí el nombre.', 'name')
  if (!Number.isInteger(input.position) || input.position < 0) throw new ContentError('El orden es un número entero.', 'position')
  return db.$transaction(async (tx) => {
    const c = await tx.articleCategory.findUniqueOrThrow({ where: { id } })
    const diff = changedFields({ name: c.name, position: c.position }, { name, position: input.position })
    if (!diff.changed) return
    await tx.articleCategory.update({ where: { id }, data: { name, position: input.position } })
    await audit(tx, actor, { action: 'update', entityType: 'ArticleCategory', entityId: id, label: name, before: diff.before, after: diff.after })
  })
}

/** Only an unused category can go: an article never loses its category silently. */
export async function deleteCategory(db: PrismaClient, actor: Actor, id: string) {
  const c = await db.articleCategory.findUniqueOrThrow({ where: { id } })
  const used = await db.article.count({
    where: { deletedAt: null, OR: [{ draft: { path: ['categorySlug'], equals: c.slug } }, { published: { path: ['categorySlug'], equals: c.slug } }] },
  })
  if (used) throw new ContentError(`La usan ${used === 1 ? 'un artículo' : `${used} artículos`}. Cambiales la categoría antes de borrarla.`)
  await db.$transaction(async (tx) => {
    await tx.articleCategory.delete({ where: { id } })
    await audit(tx, actor, { action: 'delete', entityType: 'ArticleCategory', entityId: id, label: c.name })
  })
}

