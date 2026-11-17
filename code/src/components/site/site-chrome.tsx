import Link from 'next/link'
import { Wordmark } from './wordmark'
import { ArrowRight, ConcernIcon, FaceScan, Layers, ShieldCheck } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { CONCERN } from '@/lib/diagnosis/copy'
import { CONCERNS } from '@/lib/catalog/coverage'
import { usingDatabase } from '@/server/db'

/** Non-dismissible: nobody can mistake sample content for real products (plan §7.1). */
export function DemoBanner() {
  return (
    <div className="bg-ink text-paper">
      <p className="container-page flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-2 text-center text-[0.75rem] leading-snug sm:text-[0.8125rem]">
        <span className="rounded-full bg-paper/12 px-2 py-0.5 text-[0.6875rem] font-medium tracking-[0.06em]">DEMO</span>
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

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-night-deep text-paper">
      <div className="container-page relative pt-16 pb-10 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-10">
          <div className="max-w-sm">
            <Wordmark inverse />
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-paper/70">
              Skincare con criterio: un diagnóstico, una rutina de mañana y de noche, y el motivo de cada producto.
            </p>
            <Link href="/diagnostico" className={buttonClasses('inverse', 'md', 'mt-7')}>
              <FaceScan size={19} />
              Hacer mi diagnóstico
            </Link>
          </div>

          <nav aria-label="Necesidades" className="text-sm">
            <p className="font-medium text-paper">Necesidades</p>
            <ul className="mt-4 space-y-3 text-paper/70">
              {CONCERNS.map((slug) => (
                <li key={slug}>
                  <Link href={`/productos?necesidad=${slug}`} className="inline-flex items-center gap-2.5 hover:text-paper">
                    <ConcernIcon slug={slug} size={16} />
                    {CONCERN[slug]?.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Tienda" className="text-sm">
            <p className="font-medium text-paper">La demo</p>
            <ul className="mt-4 space-y-3 text-paper/70">
              <li><Link className="hover:text-paper" href="/productos">Todos los productos</Link></li>
              <li><Link className="hover:text-paper" href="/diagnostico">Diagnóstico de piel</Link></li>
              <li><Link className="hover:text-paper" href="/producto/serum-niacinamida-10-zinc">Ficha de ejemplo</Link></li>
              <li><Link className="hover:text-paper" href="/sobre-esta-demo">Sobre esta demo</Link></li>
            </ul>
          </nav>

          <div className="text-sm">
            <p className="font-medium text-paper">Cómo está hecha</p>
            <ul className="mt-4 space-y-3 text-paper/70">
              <li className="flex gap-2.5">
                <Layers size={17} className="mt-0.5 shrink-0" />
                {usingDatabase ? 'Next.js, PostgreSQL y Prisma, el mismo stack de la propuesta.' : 'Next.js y el modelo de datos de la propuesta, sobre el catálogo de ejemplo.'}
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck size={17} className="mt-0.5 shrink-0" />
                Productos, marcas, precios y reseñas de ejemplo. Fotos generadas con IA.
              </li>
            </ul>
          </div>
        </div>

        <svg aria-hidden="true" focusable="false" viewBox="0 0 1000 190" className="pointer-events-none mt-14 block w-full max-w-5xl text-paper/[0.07] select-none">
          <text x="-8" y="160" fill="currentColor" fontFamily="var(--font-display)" fontSize="205" letterSpacing="-8">
            La<tspan fontStyle="italic">Rutina</tspan>
          </text>
        </svg>

        <div className="mt-6 flex flex-col gap-3 border-t border-paper/12 pt-6 text-xs text-paper/55 sm:flex-row sm:items-center sm:justify-between">
          <p>Demo técnica que acompaña la respuesta al challenge de LaRutina Beauty.</p>
          <Link href="/sobre-esta-demo" className="inline-flex items-center gap-1.5 hover:text-paper">
            Qué es de ejemplo en esta demo <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </footer>
  )
}
