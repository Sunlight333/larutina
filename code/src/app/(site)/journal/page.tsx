import type { Metadata } from 'next'
import Link from 'next/link'
import { PageIntro } from '@/components/catalog/page-intro'
import { getDb } from '@/server/db'
import { resolveImages } from '@/server/media'
import { getCopyVariables } from '@/server/services/site'
import { listPublishedArticles } from '@/server/services/content/articles'
import { fillVariables } from '@/lib/copy-variables'
import { ArticleCardView } from '@/components/content/article-card'

// CMS-02, JO-01, JO-02, JO-07: the journal, newest first, filtered by category.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const PAGE_SIZE = 12

export const metadata: Metadata = { title: 'Journal', description: 'Lo que vale la pena saber antes de sumar otro producto.', alternates: { canonical: '/journal' } }

export default async function JournalPage({ searchParams }: Props) {
  const sp = await searchParams
  const db = getDb()
  const categories = await db.articleCategory.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] })
  const active = categories.find((c) => c.slug === sp.categoria)
  const page = Math.max(1, Number(sp.pagina) || 1)
  const { articles, total } = await listPublishedArticles(db, { categorySlug: active?.slug, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE })
  const [vars, covers] = await Promise.all([getCopyVariables(), resolveImages(db, articles.map((a) => a.doc.coverImage))])
  const fill = (s: string) => fillVariables(s, vars)
  const catName = new Map(categories.map((c) => [c.slug, c.name]))
  const pages = Math.ceil(total / PAGE_SIZE)
  const href = (p: number) => `/journal?${new URLSearchParams({ ...(active ? { categoria: active.slug } : {}), ...(p > 1 ? { pagina: String(p) } : {}) })}`

  return (
    <>
      <PageIntro title="Journal" intro={['Lo que vale la pena saber antes de sumar otro producto.']} />
      <div className="container-page pb-12 pt-8 md:pb-16">
        {categories.length > 0 && (
          <nav aria-label="Categorías">
            <ul className="scroller -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {[{ slug: '', name: 'Todo' }, ...categories].map((c) => {
                const current = (active?.slug ?? '') === c.slug
                return (
                  <li key={c.slug || 'todo'} className="shrink-0">
                    <Link
                      href={c.slug ? `/journal?categoria=${c.slug}` : '/journal'}
                      aria-current={current ? 'page' : undefined}
                      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm ${current ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-ink-soft hover:border-ink/60 hover:text-ink'}`}
                    >
                      {c.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
        {articles.length === 0 ? (
          <p className="mt-10 rounded-[2rem] bg-shell px-6 py-14 text-center font-display text-display-sm text-ink-soft">{active ? 'Todavía no hay artículos en esta categoría.' : 'Muy pronto, los primeros artículos.'}</p>
        ) : (
          <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <ArticleCardView href={`/journal/${a.slug}`} title={fill(a.doc.title)} excerpt={fill(a.doc.excerpt)} category={catName.get(a.doc.categorySlug)} date={a.publishedAt} image={covers.get(a.doc.coverImage)} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Páginas" className="mt-12 flex items-center gap-4 text-sm">
            {page > 1 && (
              <Link href={href(page - 1)} className="underline underline-offset-4">
                Anteriores
              </Link>
            )}
            <span className="text-ink-muted">
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link href={href(page + 1)} className="underline underline-offset-4">
                Siguientes
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  )
}
