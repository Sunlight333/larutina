import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageView } from '@/components/content/render-blocks'
import { loadSitePage, sitePageMetadata, wantsPreview } from '@/server/services/content/site-pages'

// Landing, institutional and help pages built from blocks (CMS-01, CMS-03):
// /nosotras, /preguntas-frecuentes, /envios-y-devoluciones and any page made
// in the panel. ?vista-previa=1 shows the draft to the team.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return sitePageMetadata('page', (await params).slug, wantsPreview(await searchParams))
}

export default async function ContentPage({ params, searchParams }: Props) {
  const { slug } = await params
  const loaded = await loadSitePage('page', slug, wantsPreview(await searchParams))
  if (!loaded) notFound()
  return <PageView doc={loaded.doc} slug={slug} isHome={false} preview={loaded.preview} />
}
