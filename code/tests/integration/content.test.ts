// Content services against PostgreSQL: the draft and publish flows of pages
// and articles (ADM-02), legal versions kept forever (CMS-04), the seed that
// never overwrites, contact photos as private files (CMS-03), the
// announcement order (NAV-01) and the waitlist export (GEN-08).
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { setStorage, type StorageProvider } from '../../src/server/storage'
import { newBlock } from '../../src/server/services/content/blocks'
import { ContentError } from '../../src/server/services/content/errors'
import { createPage, deletePage, draftOf, getPageForSite, pageStatus, publishPage, savePageDraft } from '../../src/server/services/content/pages'
import { getLegalForSite, getLegalVersion, publishLegalVersion, saveLegalDraft } from '../../src/server/services/content/legal'
import { seedContent } from '../../src/server/services/content/seed'
import { articleStatus, createArticle, createCategory, deleteCategory, listPublishedArticles, publishArticle, saveArticleDraft, articleDraft, unpublishArticle, getArticleForSite } from '../../src/server/services/content/articles'
import { submitContactMessage, getAttachment } from '../../src/server/services/content/contact'
import { announcementState, createAnnouncement, moveAnnouncement } from '../../src/server/services/content/announcements'
import { exportWaitlist } from '../../src/server/services/content/subscribers'

let db: PrismaClient
const actor = { id: 'admin-1', email: 'editora@example.test' }

class MemoryStorage implements StorageProvider {
  files = new Map<string, Buffer>()
  async put(key: string, data: Buffer) {
    this.files.set(key, data)
  }
  async get(key: string) {
    return this.files.get(key) ?? null
  }
  async delete(key: string) {
    this.files.delete(key)
  }
}
const memory = new MemoryStorage()

beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject('databaseUrl') })
  setStorage(memory)
  await db.$executeRawUnsafe(
    `TRUNCATE pages, articles, article_categories, legal_versions, legal_documents, announcements, waitlist_signups, newsletter_subscribers, contact_messages, media_assets, audit_logs, settings CASCADE`,
  )
})
afterAll(async () => {
  await db.$disconnect()
})

const auditActions = async (entityId: string) => (await db.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action)

describe('pages: draft, preview and publish', () => {
  it('keeps a change off the site until it is published', async () => {
    const hero = newBlock('hero', 'h1', { title: 'Verano sin vueltas' })
    const page = await createPage(db, actor, { title: 'Verano', slug: 'verano', kind: 'LANDING' }, { blocks: [hero] })
    expect(await getPageForSite(db, 'verano')).toBeNull()
    expect((await getPageForSite(db, 'verano', { preview: true }))?.doc.blocks[0]?.data).toMatchObject({ title: 'Verano sin vueltas' })

    await publishPage(db, actor, page.id)
    const live = await getPageForSite(db, 'verano')
    expect(live?.doc.title).toBe('Verano')
    expect(live?.page.publishedAt).toBeInstanceOf(Date)

    const doc = draftOf((await db.page.findUniqueOrThrow({ where: { id: page.id } })))
    await savePageDraft(db, actor, page.id, { ...doc, blocks: [newBlock('hero', 'h1', { title: 'Verano, versión 2' })] })
    const saved = await db.page.findUniqueOrThrow({ where: { id: page.id } })
    expect(pageStatus(saved)).toBe('changes')
    expect((await getPageForSite(db, 'verano'))?.doc.blocks[0]?.data).toMatchObject({ title: 'Verano sin vueltas' })
    expect((await getPageForSite(db, 'verano', { preview: true }))?.doc.blocks[0]?.data).toMatchObject({ title: 'Verano, versión 2' })

    await publishPage(db, actor, page.id)
    expect(pageStatus(await db.page.findUniqueOrThrow({ where: { id: page.id } }))).toBe('published')
    expect((await getPageForSite(db, 'verano'))?.doc.blocks[0]?.data).toMatchObject({ title: 'Verano, versión 2' })
    expect(await auditActions(page.id)).toEqual(['create', 'publish', 'update', 'publish'])
  })

  it('does not record a save with no changes', async () => {
    const page = await db.page.findUniqueOrThrow({ where: { slug: 'verano' } })
    const { changed } = await savePageDraft(db, actor, page.id, draftOf(page))
    expect(changed).toBe(false)
    expect((await auditActions(page.id)).length).toBe(4)
  })

  it('refuses reserved and taken addresses, and soft-deletes to the trash', async () => {
    await expect(createPage(db, actor, { title: 'X', slug: 'journal', kind: 'LANDING' })).rejects.toThrow(ContentError)
    await expect(createPage(db, actor, { title: 'X', slug: 'verano', kind: 'LANDING' })).rejects.toThrow(/Ya hay una página/)
    const page = await db.page.findUniqueOrThrow({ where: { slug: 'verano' } })
    await deletePage(db, actor, page.id)
    expect(await getPageForSite(db, 'verano')).toBeNull()
    await expect(createPage(db, actor, { title: 'X', slug: 'verano', kind: 'LANDING' })).rejects.toThrow(/papelera/)
  })
})

describe('seed', () => {
  it('creates the content once and never overwrites it', async () => {
    const first = await seedContent(db)
    expect(first.pages).toEqual(['inicio', 'nosotras', 'preguntas-frecuentes', 'envios-y-devoluciones'])
    expect(first.legal).toHaveLength(5)
    expect(first.categories).toHaveLength(5)
    expect(first.announcements).toHaveLength(3)

    const home = await db.page.findUniqueOrThrow({ where: { slug: 'inicio' } })
    expect(home.kind).toBe('HOME')
    expect(pageStatus(home)).toBe('published')
    expect(await getPageForSite(db, 'inicio', { kinds: ['HOME'] })).not.toBeNull()
    // Legal drafts wait for the lawyer: nothing published.
    expect(await db.legalVersion.count()).toBe(0)
    // Messages that depend on a value not set yet start inactive.
    const anns = await db.announcement.findMany({ orderBy: { position: 'asc' } })
    expect(anns.map((a) => a.active)).toEqual([false, false, true])

    await savePageDraft(db, actor, home.id, { ...draftOf(home), title: 'Home editada' })
    const second = await seedContent(db)
    expect(second).toEqual({ pages: [], categories: [], legal: [], announcements: [] })
    expect((await db.page.findUniqueOrThrow({ where: { slug: 'inicio' } })).title).toBe('Home editada')
  })
})

describe('legal versions', () => {
  it('publishes n+1 and keeps every earlier version with its date and author', async () => {
    const doc = await db.legalDocument.findUniqueOrThrow({ where: { code: 'cookies' } })
    await saveLegalDraft(db, actor, doc.id, { title: 'Política de cookies', draftBody: 'Primera versión.' })
    const v1 = await publishLegalVersion(db, actor, doc.id)
    expect(v1.version).toBe(1)
    expect(v1.publishedBy).toBe(actor.email)
    await expect(publishLegalVersion(db, actor, doc.id)).rejects.toThrow(/No hay cambios/)

    await saveLegalDraft(db, actor, doc.id, { title: 'Política de cookies', draftBody: 'Segunda versión.' })
    // Saving a draft does not touch what the site shows.
    expect((await getLegalForSite(db, 'cookies'))?.current.body).toBe('Primera versión.')
    const v2 = await publishLegalVersion(db, actor, doc.id)
    expect(v2.version).toBe(2)

    const site = await getLegalForSite(db, 'cookies')
    expect(site?.current.version).toBe(2)
    expect(site?.versions.map((v) => v.version)).toEqual([2, 1])
    const old = await getLegalVersion(db, 'cookies', 1)
    expect(old?.isCurrent).toBe(false)
    expect(old?.version.body).toBe('Primera versión.')
    expect(old?.version.publishedAt.getTime()).toBe(v1.publishedAt.getTime())
    expect((await auditActions(doc.id)).filter((a) => a === 'publish')).toHaveLength(2)
    expect(await getLegalForSite(db, 'terminos')).toBeNull()
  })

  it('refuses an empty text', async () => {
    const doc = await db.legalDocument.findUniqueOrThrow({ where: { code: 'terminos' } })
    await saveLegalDraft(db, actor, doc.id, { title: doc.title, draftBody: '' })
    await expect(publishLegalVersion(db, actor, doc.id)).rejects.toThrow(/vacío/)
  })
})

describe('journal', () => {
  it('publishes an article, keeps the first publication date and tracks changes', async () => {
    const a = await createArticle(db, actor, { title: 'Doble limpieza: cuándo sí y cuándo no' })
    expect(a.slug).toBe('doble-limpieza-cuando-si-y-cuando-no')
    await expect(publishArticle(db, actor, a.id)).rejects.toThrow(/cuerpo/)

    const doc = articleDraft(a)
    await saveArticleDraft(db, actor, a.id, { ...doc, body: '## El orden\n\nPrimero el aceite.', categorySlug: 'rutinas', productCodes: ['x-1'] })
    const first = await publishArticle(db, actor, a.id, new Date('2026-11-01T12:00:00Z'))
    expect(await getArticleForSite(db, a.slug)).not.toBeNull()
    expect((await listPublishedArticles(db, { categorySlug: 'rutinas' })).articles.map((x) => x.slug)).toEqual([a.slug])
    expect((await listPublishedArticles(db, { categorySlug: 'ingredientes' })).articles).toEqual([])

    await saveArticleDraft(db, actor, a.id, { ...articleDraft(first), excerpt: 'Una bajada nueva.' })
    expect(articleStatus(await db.article.findUniqueOrThrow({ where: { id: a.id } }))).toBe('changes')
    const second = await publishArticle(db, actor, a.id, new Date('2026-11-20T12:00:00Z'))
    expect(second.publishedAt?.toISOString()).toBe('2026-11-01T12:00:00.000Z')
    expect((second.published as { versionAt: string }).versionAt).toBe('2026-11-20T12:00:00.000Z')
    expect(articleStatus(second)).toBe('published')

    // The address is fixed once published.
    await expect(saveArticleDraft(db, actor, a.id, articleDraft(second), 'otra-direccion')).rejects.toThrow(/no cambia/)
    await unpublishArticle(db, actor, a.id)
    expect(await getArticleForSite(db, a.slug)).toBeNull()
  })

  it('does not delete a category in use', async () => {
    const used = await db.articleCategory.findUniqueOrThrow({ where: { slug: 'rutinas' } })
    await expect(deleteCategory(db, actor, used.id)).rejects.toThrow(/La usan/)
    const free = await createCategory(db, actor, { name: 'Sin uso' })
    await deleteCategory(db, actor, free.id)
    expect(await db.articleCategory.findUnique({ where: { id: free.id } })).toBeNull()
  })
})

describe('contact', () => {
  it('stores the photos as private files and reports problems by field', async () => {
    const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c99' } }).jpeg().toBuffer()
    const bad = await submitContactMessage(db, { reason: 'Otro', name: 'A', email: 'no', phone: '', orderNumber: '', message: 'corto' }, [])
    expect(Object.keys(bad.errors).sort()).toEqual(['email', 'message', 'name'])
    const tooMany = await submitContactMessage(db, { reason: 'Otro', name: 'Ana', email: 'ana@example.test', phone: '', orderNumber: '', message: 'Un mensaje largo.' }, Array(5).fill({ name: 'a.jpg', type: 'image/jpeg', data: jpeg }))
    expect(tooMany.errors.photos).toMatch(/Hasta 4/)

    const ok = await submitContactMessage(
      db,
      { reason: 'Producto dañado o incorrecto', name: 'Ana Pérez', email: 'Ana@Example.test', phone: '+54 9 11 5555-0000', orderNumber: 'LR-1', message: 'Me llegó con la tapa rota.' },
      [{ name: 'tapa rota.jpg', type: 'image/jpeg', data: jpeg }],
    )
    expect(ok.errors).toEqual({})
    const msg = await db.contactMessage.findUniqueOrThrow({ where: { id: ok.id! } })
    expect(msg.email).toBe('ana@example.test')
    expect(msg.attachments).toHaveLength(1)
    expect(msg.attachments[0]).toMatch(/^private\//)
    const att = await getAttachment(db, msg.id, 0)
    expect(att?.asset.visibility).toBe('PRIVATE')
    expect(memory.files.has(msg.attachments[0]!)).toBe(true)
    expect(await getAttachment(db, msg.id, 1)).toBeNull()
  })
})

describe('announcements', () => {
  it('orders, validates dates and hides a message waiting for a value', async () => {
    const bad = await createAnnouncement(db, actor, { text: 'Hot Sale', href: 'hotsale', startsAt: '2026-12-02T10:00', endsAt: '2026-12-01T10:00', active: true })
    expect(Object.keys(bad.errors).sort()).toEqual(['endsAt', 'href'])
    await createAnnouncement(db, actor, { text: 'Hot Sale', href: '/productos', startsAt: '2026-12-01T10:00', endsAt: '', active: true })
    const rows = await db.announcement.findMany({ orderBy: { position: 'asc' } })
    const hot = rows.at(-1)!
    expect(hot.startsAt?.toISOString()).toBe('2026-12-01T13:00:00.000Z') // 10:00 in Buenos Aires
    await moveAnnouncement(db, actor, hot.id, -1)
    const after = await db.announcement.findMany({ orderBy: { position: 'asc' } })
    expect(after.map((r) => r.position)).toEqual([0, 1, 2, 3])
    expect(after[2]!.id).toBe(hot.id)

    const free = after.find((r) => r.text.includes('{envio_gratis_desde}'))!
    expect(announcementState({ ...free, active: true }, { envio_gratis_desde: '' }).state).toBe('waiting-value')
    expect(announcementState({ ...free, active: true }, { envio_gratis_desde: '$ 50.000' }).state).toBe('visible')
    expect(announcementState(hot, {}, new Date('2026-11-30T00:00:00Z')).state).toBe('scheduled')
  })
})

describe('waitlist export', () => {
  it('marks exported rows, so "solo nuevos" brings only the new ones', async () => {
    await db.waitlistSignup.createMany({ data: [{ email: 'a@example.test', consentText: 'Acepto' }, { email: 'b@example.test', consentText: 'Acepto' }] })
    const first = await exportWaitlist(db, actor, { onlyNew: true })
    expect(first.count).toBe(2)
    expect(first.csv.startsWith('﻿email,')).toBe(true)
    expect(await db.waitlistSignup.count({ where: { exportedAt: null } })).toBe(0)
    await db.waitlistSignup.create({ data: { email: 'c@example.test', consentText: 'Acepto' } })
    const second = await exportWaitlist(db, actor, { onlyNew: true })
    expect(second.count).toBe(1)
    expect(second.csv).toContain('c@example.test')
    expect((await exportWaitlist(db, actor, { onlyNew: false })).count).toBe(3)
  })
})
