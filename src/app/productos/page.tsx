import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Close, ConcernIcon, FaceScan, Search } from '@/components/icons'
import { ProductCard } from '@/components/product-card'
import { ButtonLink } from '@/components/ui/button'
import { CONCERNS, SKIN_TYPES } from '@/lib/catalog/coverage'
import { CONCERN, SKIN_TYPE, joinEs } from '@/lib/diagnosis/copy'
import { lifestyleImage } from '@/lib/images'
import { listProducts } from '@/server/services/catalog'

export const metadata: Metadata = {
  title: 'Productos',
  description: 'El catálogo de ejemplo, filtrable por tipo de piel y necesidad.',
}

type Search = { piel?: string | string[]; necesidad?: string | string[] }
type Props = { searchParams: Promise<Search> }

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(',') : [])

/** Link that toggles one value of one facet, keeping everything else. */
function toggleHref(current: { piel: string[]; necesidad: string[] }, key: 'piel' | 'necesidad', value: string) {
  const next = { ...current, [key]: current[key].includes(value) ? current[key].filter((v) => v !== value) : [...current[key], value] }
  const params = new URLSearchParams()
  if (next.piel.length) params.set('piel', next.piel.join(','))
  if (next.necesidad.length) params.set('necesidad', next.necesidad.join(','))
  const qs = params.toString()
  return qs ? `/productos?${qs}` : '/productos'
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams
  const piel = list(sp.piel).filter((s) => (SKIN_TYPES as readonly string[]).includes(s))
  const necesidad = list(sp.necesidad).filter((s) => (CONCERNS as readonly string[]).includes(s))
  const current = { piel, necesidad }
  const products = await listProducts({ skinTypes: piel, concerns: necesidad })
  const filtered = piel.length + necesidad.length > 0
  const banner = lifestyleImage(necesidad.length === 1 ? necesidad[0]! : 'manana')

  const summary = [
    piel.length ? `piel ${joinEs(piel.map((s) => SKIN_TYPE[s]?.name.toLowerCase() ?? s))}` : null,
    necesidad.length ? `foco en ${joinEs(necesidad.map((c) => CONCERN[c]?.name.toLowerCase() ?? c))}` : null,
  ].filter(Boolean)

  return (
    <>
      <section className="relative overflow-hidden bg-shell">
        <div className="container-page grid items-center gap-8 pt-10 pb-12 md:grid-cols-[1fr_17rem] md:pt-14 md:pb-16 lg:grid-cols-[1fr_20rem]">
          <div className="animate-rise">
            <p className="eyebrow">Tienda</p>
            <h1 className="mt-3 font-display text-display-lg">Productos</h1>
            <p className="mt-4 max-w-xl text-lede text-ink-soft">
              Dieciocho productos de cinco marcas, elegidos uno por uno. Filtrá por tu tipo de piel y lo que querés mejorar, o dejá que el
              diagnóstico arme la rutina por vos.
            </p>
          </div>
          <div className="relative hidden md:block">
            <div className="shape-arch relative aspect-[4/5] overflow-hidden">
              <Image src={banner.src} alt="" fill sizes="320px" placeholder="blur" blurDataURL={banner.blur} className="object-cover" priority={false} />
            </div>
            <Link
              href="/diagnostico"
              className="absolute -bottom-4 -left-8 flex items-center gap-3 rounded-full bg-paper py-2 pr-5 pl-2 text-sm font-medium shadow-[0_18px_40px_-20px_rgb(40_30_20/0.5)] transition-transform hover:-translate-y-0.5"
            >
              <span className="grid size-10 place-items-center rounded-full bg-ink text-paper">
                <FaceScan size={20} />
              </span>
              Armá tu rutina
            </Link>
          </div>
        </div>
      </section>

      <div className="container-page">
        <div className="sticky top-16 z-20 -mx-4 border-b border-line/70 bg-paper/92 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-[4.5rem] lg:-mx-8 lg:px-8">
          <div className="space-y-3">
            <FilterRow label="Tipo de piel">
              {SKIN_TYPES.map((s) => (
                <Chip key={s} href={toggleHref(current, 'piel', s)} on={piel.includes(s)}>
                  {SKIN_TYPE[s]?.name}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Necesidad">
              {CONCERNS.map((c) => (
                <Chip key={c} href={toggleHref(current, 'necesidad', c)} on={necesidad.includes(c)} icon={<ConcernIcon slug={c} size={16} />}>
                  {CONCERN[c]?.name}
                </Chip>
              ))}
            </FilterRow>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3" aria-live="polite">
          <p className="text-[0.9375rem] text-ink-soft">
            <span className="tabular font-medium text-ink">{products.length}</span> {products.length === 1 ? 'producto' : 'productos'}
            {summary.length > 0 && <> para {summary.join(', con ')}</>}
          </p>
          {filtered && (
            <Link href="/productos" scroll={false} className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              <Close size={14} />
              Limpiar filtros
            </Link>
          )}
        </div>

        <h2 className="sr-only">Resultados</h2>
        {products.length > 0 ? (
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} sizes="(min-width: 1216px) 270px, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-[2rem] bg-shell px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-paper text-ink-muted">
              <Search size={26} />
            </span>
            <p className="mt-5 font-display text-display-sm">No hay productos para esa combinación.</p>
            <p className="mt-2 max-w-md text-ink-muted">Probá sacando un filtro:</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {piel.map((s) => (
                <Chip key={s} href={toggleHref(current, 'piel', s)} on>
                  Sacar piel {SKIN_TYPE[s]?.name.toLowerCase()}
                </Chip>
              ))}
              {necesidad.map((c) => (
                <Chip key={c} href={toggleHref(current, 'necesidad', c)} on>
                  Sacar {CONCERN[c]?.name.toLowerCase()}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <aside className="mt-20 grid items-center gap-6 overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:grid-cols-[auto_1fr_auto] sm:p-8">
          <span className="grid size-14 place-items-center rounded-full bg-paper/10 ring-1 ring-paper/15">
            <FaceScan size={26} />
          </span>
          <div>
            <p className="font-display text-display-sm">¿No sabés qué elegir?</p>
            <p className="mt-1 text-sm text-paper/70">Seis preguntas y te armamos la rutina de mañana y de noche, con el motivo de cada producto.</p>
          </div>
          <ButtonLink href="/diagnostico" variant="inverse">
            Hacer mi diagnóstico
          </ButtonLink>
        </aside>

        <p className="mt-6 text-[0.8125rem] leading-relaxed text-ink-muted">
          Cómo filtra: dentro de un mismo grupo, las opciones se suman (piel seca o sensible); entre grupos, se combinan (piel seca y foco en
          rojeces). Una necesidad lista los productos que trabajan de verdad sobre ella.
        </p>
      </div>
    </>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <p className="hidden w-24 shrink-0 text-[0.8125rem] font-medium text-ink-muted md:block">{label}</p>
      <div className="scroller -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" aria-label={label} role="group">
        {children}
      </div>
    </div>
  )
}

function Chip({ href, on, icon, children }: { href: string; on: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? 'true' : undefined}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors ${
        on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-ink-soft hover:border-ink/60 hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}
