import Link from 'next/link'
import { Wordmark } from './wordmark'
import { ArrowRight } from '@/components/icons'

/** Non-dismissible: nobody can mistake sample content for real products (plan §7.1). */
export function DemoBanner() {
  return (
    <div className="bg-ink text-paper">
      <p className="container-page flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-2 text-center text-[0.75rem] leading-snug sm:text-[0.8125rem]">
        <span>
          Demo técnica<span className="hidden sm:inline"> para LaRutina Beauty</span>.{' '}
          <span className="text-paper/70">Productos y marcas de ejemplo.</span>
        </span>
        <Link href="/sobre-esta-demo" className="font-medium underline decoration-paper/40 underline-offset-4 hover:decoration-paper">
          Sobre esta demo
        </Link>
      </p>
    </div>
  )
}

export function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="LaRutina Beauty, inicio" className="-ml-1 rounded-md px-1">
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-[0.9375rem]">
          <Link href="/producto/serum-niacinamida-10-zinc" className="hidden rounded-full px-3 py-2 text-ink-soft hover:text-ink sm:inline-flex">
            Ficha de ejemplo
          </Link>
          <Link href="/sobre-esta-demo" className="hidden rounded-full px-3 py-2 text-ink-soft hover:text-ink sm:inline-flex">
            Sobre la demo
          </Link>
          <Link
            href="/diagnostico"
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-medium hover:border-ink"
          >
            Diagnóstico
            <ArrowRight size={16} />
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-shell">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Demo técnica que acompaña la respuesta al challenge. Marcas, productos, precios y reseñas son de ejemplo, y las fotos de
            producto fueron generadas con IA.
          </p>
        </div>
        <nav aria-label="Demo" className="text-sm">
          <p className="font-medium">La demo</p>
          <ul className="mt-3 space-y-2 text-ink-muted">
            <li><Link className="hover:text-ink" href="/diagnostico">Diagnóstico</Link></li>
            <li><Link className="hover:text-ink" href="/producto/serum-niacinamida-10-zinc">Ficha de producto</Link></li>
            <li><Link className="hover:text-ink" href="/sobre-esta-demo">Sobre esta demo</Link></li>
          </ul>
        </nav>
        <div className="text-sm">
          <p className="font-medium">Cómo está hecha</p>
          <p className="mt-3 leading-relaxed text-ink-muted">Next.js, PostgreSQL y Prisma, el mismo stack de la propuesta.</p>
        </div>
      </div>
    </footer>
  )
}
