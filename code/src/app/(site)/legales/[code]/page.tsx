import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/server/db'
import { siteAccess } from '@/server/site-access'
import { getLegalForSite } from '@/server/services/content/legal'
import { wantsPreview } from '@/server/services/content/site-pages'
import { LegalView } from '@/components/content/legal-view'

// CMS-04: the version in force of a legal document, with its date and links
// to the earlier ones. ?vista-previa=1 shows the draft to the team.

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const load = cache(async (code: string, previewRequested: boolean) => {
  const db = getDb()
  if (previewRequested && (await siteAccess()).team) {
    const doc = await db.legalDocument.findUnique({ where: { code }, include: { versions: { orderBy: { version: 'desc' } } } })
    return doc ? { preview: true as const, title: doc.title, body: doc.draftBody, versions: doc.versions } : null
  }
  const legal = await getLegalForSite(db, code)
  return legal ? { preview: false as const, title: legal.current.title, body: legal.current.body, versions: legal.versions } : null
})

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const loaded = await load((await params).code, wantsPreview(await searchParams))
  // LE-08: "[Nombre de la página] · Larutina Beauty", indexable, no commercial description.
  return loaded ? { title: loaded.title, alternates: { canonical: `/legales/${(await params).code}` }, ...(loaded.preview ? { robots: { index: false } } : {}) } : {}
}

export default async function LegalPage({ params, searchParams }: Props) {
  const { code } = await params
  const loaded = await load(code, wantsPreview(await searchParams))
  if (!loaded) notFound()
  return (
    <LegalView
      code={code}
      title={loaded.title}
      body={loaded.body}
      version={loaded.preview ? null : (loaded.versions[0] ?? null)}
      versions={loaded.versions}
      notice={
        loaded.preview ? (
          <p role="status" className="mb-6 rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent-ink">
            Vista previa del borrador: no es lo que ven las visitas.
          </p>
        ) : null
      }
    />
  )
}
