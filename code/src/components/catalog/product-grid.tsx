import { Fragment } from 'react'
import type { ProductCardData } from '@/server/services/catalog/cards'
import { getCopyVariables } from '@/server/services/site'
import { FaceScan } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { ProductCard } from './product-card'

/** S-15: the dark diagnosis banner inside the grid. The question count is a copy variable (GEN-06). */
export async function DiagnosisBanner({ title = '¿No sabés qué elegir?', className = '' }: { title?: string; className?: string }) {
  const vars = await getCopyVariables()
  return (
    <aside className={`grid items-center gap-6 overflow-hidden rounded-[1.5rem_4rem_1.5rem_4rem] bg-ink p-6 shadow-[var(--shadow-lift)] text-paper sm:grid-cols-[auto_1fr_auto] sm:p-8 ${className}`} aria-label="Diagnóstico">
      <span className="grid size-14 place-items-center rounded-full bg-paper/10 ring-1 ring-paper/15">
        <FaceScan size={26} />
      </span>
      <div>
        <h2 className="font-display text-display-sm">{title}</h2>
        <p className="mt-1 text-sm text-paper/70">
          Respondé {vars.preguntas} preguntas y te armamos la rutina de mañana y de noche, con el motivo de cada producto.
        </p>
      </div>
      <ButtonLink href="/diagnostico" variant="inverse" className="justify-self-start sm:justify-self-auto">
        Hacer mi diagnóstico
      </ButtonLink>
    </aside>
  )
}

/** Product grid, with the diagnosis banner after the 8th product when there are more (S-15). */
export function ProductGrid({
  products,
  banner,
  bannerAfter = 8,
  eagerFirst = 0,
  headingLevel,
  columns = 4,
}: {
  products: ProductCardData[]
  banner?: React.ReactNode
  bannerAfter?: number
  eagerFirst?: number
  headingLevel?: 'h2' | 'h3'
  columns?: 3 | 4
}) {
  return (
    <ul className={`grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 ${columns === 4 ? 'lg:grid-cols-4' : ''}`}>
      {products.map((p, i) => (
        <Fragment key={p.code}>
          {banner && i === bannerAfter && <li className="col-span-full">{banner}</li>}
          <li data-reveal="up" style={{ '--i': i % 4 } as React.CSSProperties}>
            <ProductCard product={p} eager={i < eagerFirst} headingLevel={headingLevel} />
          </li>
        </Fragment>
      ))}
    </ul>
  )
}
