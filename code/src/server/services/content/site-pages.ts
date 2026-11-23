import { cache } from 'react'
import type { Metadata } from 'next'
import type { PageKind } from '@prisma/client'
import { getDb } from '@/server/db'
import { siteAccess } from '@/server/site-access'
import { getCopyVariables } from '@/server/services/site'
import { fillVariables } from '@/lib/copy-variables'
import { getPageForSite, HOME_SLUG } from './pages'

// Storefront side of block pages: which document a request sees (published,
// or the draft for the team with ?vista-previa=1) and its metadata.

const PUBLIC_KINDS: PageKind[] = ['LANDING', 'INSTITUTIONAL', 'HELP']

export function wantsPreview(sp: Record<string, string | string[] | undefined>) {
  return sp['vista-previa'] !== undefined
}

/** Per request, so the page and its metadata share one query. */
export const loadSitePage = cache(async (route: 'home' | 'page', slug: string, previewRequested: boolean) => {
  if (!process.env.DATABASE_URL) return null
  // Only a signed-in team member sees drafts (ADM-02); anyone else gets the published page.
  const preview = previewRequested && !!(await siteAccess()).team
  // /inicio is not a second address of the Home: the [slug] route only serves the other kinds.
  return getPageForSite(getDb(), route === 'home' ? HOME_SLUG : slug, { preview, kinds: route === 'home' ? ['HOME'] : PUBLIC_KINDS })
})

export async function sitePageMetadata(route: 'home' | 'page', slug: string, previewRequested: boolean): Promise<Metadata> {
  const loaded = await loadSitePage(route, slug, previewRequested)
  if (!loaded) return {}
  const vars = await getCopyVariables()
  const fill = (s: string) => fillVariables(s, vars)
  const { doc } = loaded
  const isHome = route === 'home'
  const title = fill(doc.seoTitle || doc.title)
  const description = doc.seoDescription ? fill(doc.seoDescription) : undefined
  return {
    // The Home's SEO title already carries the brand (H-28); other pages get "· Larutina Beauty" from the template.
    title: isHome ? (doc.seoTitle ? { absolute: title } : undefined) : title,
    description,
    alternates: { canonical: isHome ? '/' : `/${slug}` },
    openGraph: { title, description, url: isHome ? '/' : `/${slug}` },
    ...(loaded.preview ? { robots: { index: false, follow: false } } : {}),
  }
}
