import type { Metadata } from 'next'
import { PageView } from '@/components/content/render-blocks'
import { HOME_SLUG } from '@/server/services/content/pages'
import { loadSitePage, sitePageMetadata, wantsPreview } from '@/server/services/content/site-pages'

// The Home, built from blocks in the panel (CMS-01). /?vista-previa=1 shows
// the draft to the team.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return sitePageMetadata('home', HOME_SLUG, wantsPreview(await searchParams))
}

export default async function HomePage({ searchParams }: Props) {
  const loaded = await loadSitePage('home', HOME_SLUG, wantsPreview(await searchParams))
  if (!loaded) {
    // Before the content is loaded (seed or panel) the site still has a page.
    return (
      <section className="container-page py-24">
        <h1 className="font-display text-display-lg">Larutina</h1>
      </section>
    )
  }
  return <PageView doc={loaded.doc} slug={HOME_SLUG} isHome preview={loaded.preview} />
}
