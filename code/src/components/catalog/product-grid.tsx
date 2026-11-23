import { Fragment } from 'react'
import type { ProductCardData } from '@/server/services/catalog/cards'
import { getCopyVariables } from '@/server/services/site'
import { ButtonLink } from '@/components/ui/button'
import { ProductCard } from './product-card'

/** S-15: the dark diagnosis banner inside the grid. The question count is a copy variable (GEN-06). */
export async function DiagnosisBanner({ title = '¿No sabés qué elegir?', className = '' }: { title?: string; className?: string }) {
  const vars = await getCopyVariables()
  return (
    <aside className={`rounded-[var(--radius-card)] bg-night-deep px-6 py-8 text-paper sm:px-10 sm:py-10 ${className}`} aria-label="Diagnóstico">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-display-sm">{title}</h2>
          <p className="mt-2 text-paper/75">
            Respondé {vars.preguntas} preguntas y te armamos la rutina de mañana y de noche, con el motivo de cada producto.
          </p>
        </div>
        <ButtonLink href="/diagnostico" variant="inverse" className="shrink-0">
          Hacer mi diagnóstico
        </ButtonLink>
      </div>
    </aside>
  )
}

/** Product grid, with the diagnosis banner after the 8th product when there are more (S-15). */
export function ProductGrid({ products, banner, bannerAfter = 8, eagerFirst = 0, headingLevel }: { products: ProductCardData[]; banner?: React.ReactNode; bannerAfter?: number; eagerFirst?: number; headingLevel?: 'h2' | 'h3' }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => (
        <Fragment key={p.code}>
          {banner && i === bannerAfter && <li className="col-span-full">{banner}</li>}
          <li>
            <ProductCard product={p} eager={i < eagerFirst} headingLevel={headingLevel} />
          </li>
        </Fragment>
      ))}
    </ul>
  )
}
