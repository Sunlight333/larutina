import Link from 'next/link'

export type Crumb = { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-ink hover:underline hover:underline-offset-2">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'text-ink-soft' : ''}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Page heading with the editorial intro (plain paragraphs from the panel, NAV-05). */
export function PageIntro({ crumbs, eyebrow, title, intro, children }: { crumbs?: Crumb[]; eyebrow?: string; title: string; intro?: string[]; children?: React.ReactNode }) {
  return (
    <header className="container-page pb-8 pt-8 sm:pt-12">
      {crumbs && <Breadcrumb items={crumbs} />}
      {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
      <h1 className={`${eyebrow ? 'mt-2' : crumbs ? 'mt-6' : ''} max-w-3xl font-display text-display-lg text-balance`}>{title}</h1>
      {intro && intro.length > 0 && (
        <div className="mt-5 max-w-2xl space-y-3 text-lede text-ink-soft">
          {intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      {children}
    </header>
  )
}
