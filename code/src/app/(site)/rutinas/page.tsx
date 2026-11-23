import type { Metadata } from 'next'
import Link from 'next/link'
import { Moon, Sun } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { PageIntro } from '@/components/catalog/page-intro'
import { ProductImage } from '@/components/catalog/product-image'
import { toCards } from '@/server/services/catalog/cards'
import { getPublishedRoutines, type RoutineStepView } from '@/server/services/catalog/routines'
import { getSettings } from '@/server/settings'
import { formatARS } from '@/lib/money'
import { lowerFirst } from '@/server/services/catalog/rules'
import { canSeeCatalog } from '@/server/services/catalog/viewer'

export const metadata: Metadata = {
  title: 'Rutinas de skincare coreano',
  description: 'Rutinas completas de mañana y de noche, pensadas para las necesidades más comunes.',
  alternates: { canonical: '/rutinas' },
}

// RU-01, RU-02: read-only until the routine pages arrive (Phase 3): the
// published routines with their steps and products.
export default async function RoutinesPage() {
  if (!(await canSeeCatalog())) return null
  const [routines, s] = await Promise.all([getPublishedRoutines(), getSettings()])
  const products = routines.flatMap((r) => r.steps.map((st) => st.product)).filter((p): p is NonNullable<typeof p> => !!p)
  const cards = new Map((await toCards([...new Map(products.map((p) => [p.code, p])).values()])).map((c) => [c.code, c]))

  return (
    <>
      <PageIntro
        crumbs={[{ label: 'Inicio', href: '/' }, { label: 'Rutinas' }]}
        title="Rutinas armadas"
        intro={
          routines.length
            ? [`${routines.length === 1 ? 'Una rutina completa' : `${routines.length} rutinas completas`}, de mañana y de noche, pensadas para las necesidades más comunes. Si querés una a tu medida, hacé el diagnóstico.`]
            : ['Estamos armando las rutinas. Mientras tanto, podés elegir los productos por lo que querés mejorar.']
        }
      >
        <div className="mt-6">
          <ButtonLink href={routines.length ? '/diagnostico' : '/necesidades'} variant="secondary">
            {routines.length ? 'Hacer mi diagnóstico' : 'Elegir por necesidad'}
          </ButtonLink>
        </div>
      </PageIntro>

      <div className="container-page space-y-16">
        {routines.map((r) => (
          <section key={r.code} id={r.code} aria-labelledby={`r-${r.code}`} className="scroll-mt-24 border-t border-line pt-10">
            <div className="max-w-2xl">
              <h2 id={`r-${r.code}`} className="font-display text-display-md">
                {r.name}
              </h2>
              <p className="mt-2 text-lede text-ink-soft">{r.goal}</p>
              <p className="mt-3 text-sm text-ink-muted">
                {[r.momentLabel, r.difficulty && `Rutina ${r.difficulty.toLocaleLowerCase('es-AR')}`, r.skinTypes.length && `Piel ${r.skinTypes.map(lowerFirst).join(', ')}`].filter(Boolean).join(' · ')}
              </p>
              {r.description.map((p, i) => (
                <p key={i} className="mt-3 text-ink-soft">
                  {p}
                </p>
              ))}
            </div>
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              {(['AM', 'PM'] as const).map((m) => {
                const steps = r.steps.filter((st) => st.moment === m || st.moment === 'BOTH')
                if (!steps.length) return null
                return (
                  <div key={m}>
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      {m === 'AM' ? <Sun size={18} /> : <Moon size={18} />}
                      {m === 'AM' ? 'De mañana' : 'De noche'}
                    </h3>
                    <ol className="mt-4 space-y-3">
                      {steps.map((st, i) => (
                        <Step key={`${m}-${st.position}`} n={i + 1} step={st} card={st.product ? cards.get(st.product.code) : undefined} />
                      ))}
                    </ol>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        <p className="max-w-2xl text-sm text-ink-muted">{s['copy.healthNotice']}</p>
      </div>
    </>
  )
}

function Step({ n, step, card }: { n: number; step: RoutineStepView; card?: Awaited<ReturnType<typeof toCards>>[number] }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line p-4">
      {card && (
        <Link href={`/producto/${card.code}`} className="w-16 shrink-0" tabIndex={-1} aria-hidden="true">
          <ProductImage image={card.image} alt="" step={card.routineStep} sizes="4rem" className="rounded-lg" />
        </Link>
      )}
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">
          Paso {n} · {step.stepLabel}
          {step.optional && ' · opcional'}
          {step.frequency && ` · ${step.frequency}`}
        </p>
        <p className="mt-0.5 font-medium">{step.title}</p>
        {card ? (
          <p className="mt-1 text-sm">
            <Link href={`/producto/${card.code}`} className="underline underline-offset-2">
              {card.name}
            </Link>{' '}
            <span className="tabular text-ink-muted">· {formatARS(card.chargedCents)}</span>
          </p>
        ) : null}
        {step.instruction && <p className="mt-1.5 text-sm text-ink-soft">{step.instruction}</p>}
      </div>
    </li>
  )
}
