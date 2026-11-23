import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/server/db'
import { mediaUrl, resolveImages } from '@/server/media'
import { getSettings } from '@/server/settings'
import { siteAccess } from '@/server/site-access'
import { getCopyVariables } from '@/server/services/site'
import { getArticleForSite, relatedArticles } from '@/server/services/content/articles'
import { articleJsonLd } from '@/server/services/content/article-ld'
import { getProductTeasers, getRoutineTeasers } from '@/server/services/content/catalog'
import { wantsPreview } from '@/server/services/content/site-pages'
import { fillVariables } from '@/lib/copy-variables'
import { readingMinutes } from '@/lib/markdown'
import { ArticleCardView } from '@/components/content/article-card'
import { CtaButton } from '@/components/content/blocks/shared'
import { longDate } from '@/components/content/format'
import { JsonLd } from '@/components/content/json-ld'
import { ProductGrid } from '@/components/content/product-teaser'
import { Prose } from '@/components/content/prose'

// CMS-02, JO-06: an article with author, "Revisado por", reading time, the
// products and routines it mentions, related articles and Article data for
// Google. ?vista-previa=1 shows the draft to the team.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const load = cache(async (slug: string, previewRequested: boolean) => {
  const preview = previewRequested && !!(await siteAccess()).team
  const found = await getArticleForSite(getDb(), slug, preview)
  if (!found) return null
  const vars = await getCopyVariables()
  const fill = (s: string) => fillVariables(s, vars)
  return { ...found, title: fill(found.doc.title), excerpt: fill(found.doc.excerpt), body: fill(found.doc.body) }
})

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = await load(slug, wantsPreview(await searchParams))
  if (!a) return {}
  const s = await getSettings()
  // JO-07: "[Título del artículo] · Journal Larutina"; the description is the bajada.
  const title = `${a.doc.seoTitle || a.title} · Journal ${s['brand.name']}`
  const description = a.doc.seoDescription || a.excerpt || undefined
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/journal/${slug}` },
    openGraph: { type: 'article', title, description, url: `/journal/${slug}`, images: a.doc.coverImage ? [{ url: mediaUrl(a.doc.coverImage) }] : undefined },
    ...(a.preview ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const { slug } = await params
  const a = await load(slug, wantsPreview(await searchParams))
  if (!a) notFound()
  const db = getDb()
  const s = await getSettings()
  const [category, products, routines, related, cover] = await Promise.all([
    a.doc.categorySlug ? db.articleCategory.findUnique({ where: { slug: a.doc.categorySlug } }) : null,
    getProductTeasers(db, a.doc.productCodes),
    a.doc.routineCodes.length ? getRoutineTeasers(db, a.doc.routineCodes) : Promise.resolve([]),
    relatedArticles(db, slug, a.doc),
    a.doc.coverImage ? resolveImages(db, [a.doc.coverImage]).then((m) => m.get(a.doc.coverImage)) : Promise.resolve(undefined),
  ])
  const [relatedCovers, vars] = await Promise.all([resolveImages(db, related.map((r) => r.doc.coverImage)), getCopyVariables()])
  const author = a.doc.author || s['brand.name']
  const published = a.article.publishedAt ?? new Date()
  const modified = new Date(a.doc.versionAt)
  const url = new URL(`/journal/${slug}`, siteUrl).toString()

  return (
    <article className="pb-8">
      {a.preview && (
        <p role="status" className="bg-accent-soft px-4 py-2 text-center text-sm text-accent-ink">
          Vista previa del borrador: así se va a ver al publicar.
        </p>
      )}
      <header className="container-page pt-12 md:pt-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-ink-muted">
            <Link href="/journal" className="underline-offset-4 hover:underline">
              Journal
            </Link>
            {category && (
              <>
                {' · '}
                <Link href={`/journal?categoria=${category.slug}`} className="underline-offset-4 hover:underline">
                  {category.name}
                </Link>
              </>
            )}
          </p>
          <h1 className="mt-4 font-display text-display-lg text-balance">{a.title}</h1>
          {a.excerpt && <p className="mt-5 text-lede text-ink-soft">{a.excerpt}</p>}
          <p className="mt-6 text-sm text-ink-muted">
            Por {author} · <time dateTime={published.toISOString()}>{longDate(published)}</time> · {readingMinutes(a.body)} min de lectura
          </p>
          {a.doc.reviewedBy && <p className="mt-1 text-sm text-ink-muted">Revisado por {a.doc.reviewedBy}</p>}
        </div>
      </header>
      {cover && (
        <div className="container-page mt-10">
          <div className="relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-[var(--radius-image)] bg-sand">
            <Image src={cover.src} alt={a.doc.coverAlt || cover.alt || ''} fill priority sizes="(min-width: 80rem) 64rem, 100vw" className="object-cover" />
          </div>
        </div>
      )}
      <div className="container-page mt-10">
        <Prose source={a.body} className="mx-auto max-w-2xl text-[1.0625rem]" />
      </div>

      {products.length > 0 && (
        <section className="container-page mt-16" aria-labelledby="productos-del-articulo">
          <h2 id="productos-del-articulo" className="font-display text-display-sm">
            Los productos de este artículo
          </h2>
          <div className="mt-6">
            <ProductGrid products={products} />
          </div>
        </section>
      )}
      {routines.length > 0 && (
        <section className="container-page mt-16" aria-labelledby="rutinas-del-articulo">
          <h2 id="rutinas-del-articulo" className="font-display text-display-sm">
            Rutinas que lo aplican
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routines.map((r) => (
              <li key={r.code}>
                <Link href={r.href} className="block h-full rounded-[var(--radius-card)] bg-shell p-6 hover:bg-sand">
                  <span className="block font-display text-[1.375rem] leading-tight">{r.name}</span>
                  <span className="mt-2 block text-[0.9375rem] text-ink-soft">{r.goal}</span>
                  <span className="mt-4 block text-sm text-ink-muted">{r.steps === 1 ? '1 paso' : `${r.steps} pasos`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container-page mt-16">
        <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] bg-shell px-6 py-8 text-center">
          <p className="font-display text-display-sm text-balance">¿No sabés por dónde empezar?</p>
          <div className="mt-5 flex justify-center">
            <CtaButton label="Hacer mi diagnóstico" href="/diagnostico" />
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-page mt-16" aria-labelledby="relacionados">
          <h2 id="relacionados" className="font-display text-display-sm">
            Artículos relacionados
          </h2>
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <ArticleCardView href={`/journal/${r.slug}`} title={fillVariables(r.doc.title, vars)} excerpt={fillVariables(r.doc.excerpt, vars)} date={r.publishedAt} image={relatedCovers.get(r.doc.coverImage)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!a.preview && (
        <JsonLd
          data={articleJsonLd({
            url,
            headline: a.title,
            description: a.excerpt,
            image: cover ? new URL(cover.src, siteUrl).toString() : null,
            author,
            brandName: s['brand.name'],
            publisher: s['brand.fullName'],
            datePublished: published,
            dateModified: modified > published ? modified : published,
            reviewedBy: a.doc.reviewedBy,
          })}
        />
      )}
    </article>
  )
}
