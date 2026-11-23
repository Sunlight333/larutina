import Image from 'next/image'
import Link from 'next/link'
import { FaceScan } from '@/components/icons'
import type { CampaignImage } from '@/lib/images'

export type Crumb = { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-ink-muted">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'truncate text-ink-soft' : ''}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Page heading in the design's shell band: breadcrumb, label, title and the
 * editorial intro (plain paragraphs from the panel, NAV-05). With `image`,
 * a campaign portrait in an arch sits beside it from tablets up, with the
 * invitation to the diagnosis.
 */
export function PageIntro({
  crumbs,
  eyebrow,
  title,
  intro,
  image,
  children,
}: {
  crumbs?: Crumb[]
  eyebrow?: string
  title: string
  intro?: string[]
  image?: CampaignImage
  children?: React.ReactNode
}) {
  return (
    <header className="relative overflow-hidden bg-shell">
      <div className={`container-page grid items-center gap-8 pb-12 pt-8 md:pb-16 md:pt-12 ${image ? 'md:grid-cols-[1fr_17rem] lg:grid-cols-[1fr_20rem]' : ''}`}>
        <div className="animate-rise min-w-0">
          {crumbs && <Breadcrumb items={crumbs} />}
          {eyebrow && <p className={`eyebrow ${crumbs ? 'mt-6' : ''}`}>{eyebrow}</p>}
          <h1 className={`${eyebrow ? 'mt-3' : crumbs ? 'mt-6' : ''} max-w-3xl font-display text-display-lg text-balance`}>{title}</h1>
          {intro && intro.length > 0 && (
            <div className="mt-4 max-w-xl space-y-3 text-lede text-ink-soft">
              {intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {children}
        </div>
        {image && (
          <div className="relative hidden md:block">
            <div className="shape-arch relative aspect-[4/5] overflow-hidden bg-sand">
              <Image src={image.src} alt="" fill sizes="320px" placeholder="blur" blurDataURL={image.blur} className="object-cover" />
            </div>
            <Link
              href="/diagnostico"
              className="absolute -bottom-4 -left-8 flex items-center gap-3 rounded-full bg-paper py-2 pl-2 pr-5 text-sm font-medium shadow-[0_18px_40px_-20px_rgb(40_30_20/0.5)] transition-transform hover:-translate-y-0.5"
            >
              <span className="grid size-10 place-items-center rounded-full bg-ink text-paper">
                <FaceScan size={20} />
              </span>
              Armá tu rutina
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
