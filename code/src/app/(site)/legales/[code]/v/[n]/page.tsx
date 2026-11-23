import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { getLegalVersion } from '@/server/services/content/legal'
import { LegalView } from '@/components/content/legal-view'

// An earlier version of a legal document, kept with its date (CMS-04), so
// anyone can see what applied when they bought.

type Props = { params: Promise<{ code: string; n: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code, n } = await params
  const found = await getLegalVersion(getDb(), code, Number(n))
  // Only the version in force is indexed; old ones point to it.
  return found ? { title: `${found.version.title} (versión ${found.version.version})`, robots: { index: false, follow: true }, alternates: { canonical: `/legales/${code}` } } : {}
}

export default async function LegalVersionPage({ params }: Props) {
  const { code, n } = await params
  if (!/^\d{1,6}$/.test(n)) notFound()
  const found = await getLegalVersion(getDb(), code, Number(n))
  if (!found) notFound()
  if (found.isCurrent) permanentRedirect(`/legales/${code}`)
  return (
    <LegalView
      code={code}
      title={found.version.title}
      body={found.version.body}
      version={found.version}
      versions={found.doc.versions}
      notice={
        <p role="note" className="mb-6 rounded-lg bg-shell px-4 py-3 text-sm">
          Esta versión ya no está vigente.{' '}
          <Link href={`/legales/${code}`} className="font-medium underline underline-offset-4">
            Ver la versión vigente
          </Link>
          .
        </p>
      }
    />
  )
}
