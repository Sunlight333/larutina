import Link from 'next/link'
import type { LegalVersion } from '@prisma/client'
import { Prose } from './prose'
import { longDate } from './format'

// A legal document as the site shows it (CMS-04): the version, the date it
// applies from, and links to every earlier version.

export function LegalView({
  code,
  title,
  body,
  version,
  versions,
  notice,
}: {
  code: string
  title: string
  body: string
  version: Pick<LegalVersion, 'version' | 'publishedAt'> | null
  versions: Pick<LegalVersion, 'version' | 'publishedAt'>[]
  notice?: React.ReactNode
}) {
  const current = versions[0]
  const others = versions.filter((v) => v.version !== version?.version)
  return (
    <article className="container-page py-12 md:py-16">
      <div className="max-w-3xl">
        {notice}
        <h1 className="font-display text-display-lg text-balance">{title}</h1>
        {version && (
          <p className="mt-4 text-sm text-ink-muted">
            Versión {version.version} · {current && current.version === version.version ? 'vigente desde el' : 'publicada el'} {longDate(version.publishedAt)}
          </p>
        )}
        <Prose source={body} className="mt-10 text-[1.0625rem]" />
        {others.length > 0 && (
          <nav aria-label="Otras versiones" className="mt-14 border-t border-line pt-6 text-sm">
            <h2 className="font-medium">Otras versiones</h2>
            <ul className="mt-3 space-y-1.5">
              {others.map((v) => (
                <li key={v.version}>
                  <Link href={current?.version === v.version ? `/legales/${code}` : `/legales/${code}/v/${v.version}`} className="underline underline-offset-4">
                    Versión {v.version}
                  </Link>{' '}
                  <span className="text-ink-muted">
                    · {current?.version === v.version ? 'vigente, ' : ''}
                    {longDate(v.publishedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </article>
  )
}
