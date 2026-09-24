import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CopyLinkButton } from '@/components/copy-link-button'
import { Alert, Bulb, ChevronDown, ConcernIcon, FaceScan, IconBadge, Info, Moon, Refresh, ShieldCheck, StepIcon, Sun } from '@/components/icons'
import { ProductImage } from '@/components/product-image'
import { ButtonLink } from '@/components/ui/button'
import { Curve } from '@/components/ui/curve'
import { CONCERN, SKIN_TYPE, STEP, joinEs } from '@/lib/diagnosis/copy'
import type { RoutineStep } from '@/lib/diagnosis/engine'
import { lifestyleImage } from '@/lib/images'
import { formatARS, sumCents } from '@/lib/money'
import { getCatalog, type CatalogProduct } from '@/server/services/catalog'
import { getDiagnosisResult } from '@/server/services/diagnosis'

// Results are immutable: render once on first visit, then serve from cache.
export const dynamicParams = true
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getDiagnosisResult((await params).id)
  if (!result) return { title: 'Resultado no encontrado' }
  const skin = SKIN_TYPE[result.skinType]?.name.toLowerCase() ?? result.skinType
  return { title: `Tu rutina para piel ${skin}` }
}

const PLAIN_CONCERN: Record<string, string> = {
  acne: 'tendencia a granitos',
  manchas: 'manchas',
  deshidratacion: 'falta de hidratación',
  sensibilidad: 'rojeces',
  lineas: 'primeras líneas finas',
  poros: 'poros visibles',
}

const ATTRIBUTE_LABEL: Record<string, string> = {
  'skin:seca': 'Piel seca',
  'skin:grasa': 'Piel grasa',
  'skin:mixta': 'Piel mixta',
  'skin:normal': 'Piel normal',
  'skin:sensible': 'Piel sensible',
  'concern:acne': 'Granitos',
  'concern:manchas': 'Manchas',
  'concern:deshidratacion': 'Deshidratación',
  'concern:sensibilidad': 'Rojeces',
  'concern:lineas': 'Líneas finas',
  'concern:poros': 'Poros y brillo',
  'flag:sensitive': 'Reacciona a productos nuevos',
}

export default async function ResultPage({ params }: Props) {
  const { id } = await params
  const [result, { products }] = await Promise.all([getDiagnosisResult(id), getCatalog()])
  if (!result) notFound()

  const byId = new Map(products.map((p) => [p.id, p]))
  // A product removed from the catalog after the diagnosis drops out quietly
  // rather than leaving an empty step.
  const am = result.routine.am.filter((s) => byId.has(s.productId))
  const pm = result.routine.pm.filter((s) => byId.has(s.productId))
  const unique = [...new Set([...am, ...pm].map((s) => s.productId))]
  const totalCents = sumCents(unique.map((pid) => byId.get(pid)!.priceCents))

  const { interpretation: interp } = result
  const skin = SKIN_TYPE[result.skinType] ?? { name: result.skinType, summary: '' }
  const concerns = interp.concerns.filter((c) => CONCERN[c.slug])
  // "Piel grasa que reacciona con facilidad, con tendencia a granitos y poros visibles. Preferís una rutina corta."
  const understood =
    `Piel ${skin.name.toLowerCase()}` +
    (interp.sensitive && result.skinType !== 'sensible' ? ' que reacciona con facilidad' : '') +
    (concerns.length ? `, con ${joinEs(concerns.map((c) => PLAIN_CONCERN[c.slug] ?? c.slug))}` : '') +
    '. ' +
    (interp.steps === 'basic' ? 'Preferís una rutina corta.' : 'Querés una rutina completa.')

  const attributeRows = Object.entries(result.attributes)
    .filter(([k, v]) => ATTRIBUTE_LABEL[k] && v > 0)
    .sort((a, b) => b[1] - a[1])
  const maxScore = Math.max(...attributeRows.map(([, v]) => v), 1)

  return (
    <>
      <section className="relative overflow-hidden bg-shell">
        <div className="container-page grid gap-10 pt-10 pb-20 md:pt-14 md:pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper py-1.5 pr-3.5 pl-1.5 text-[0.8125rem] font-medium ring-1 ring-line">
              <span className="grid size-6 place-items-center rounded-full bg-accent text-paper">
                <FaceScan size={14} />
              </span>
              Tu diagnóstico
            </p>
            <p className="mt-8 font-display text-display-sm text-ink-soft italic">Tu piel es</p>
            <h1 className="font-display text-display-xl">{skin.name}</h1>
            {interp.sensitive && result.skinType !== 'sensible' && (
              <p className="mt-4 inline-flex items-center rounded-full border border-line-strong bg-paper px-3 py-1 text-sm">con tendencia sensible</p>
            )}
            <p className="mt-6 max-w-xl text-lede text-ink-soft">{skin.summary}</p>
            {interp.sensitive && (
              <p className="mt-6 flex max-w-xl items-start gap-3 rounded-[1.5rem] bg-paper p-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                <IconBadge size="sm">
                  <ShieldCheck size={18} />
                </IconBadge>
                Como tu piel reacciona con facilidad, dejamos afuera el retinol, los ácidos exfoliantes y la vitamina C pura.
              </p>
            )}
          </div>

          {concerns.length > 0 && (
            <div className="animate-rise [animation-delay:120ms]">
              <h2 className="eyebrow">En qué nos vamos a enfocar</h2>
              <ul className="mt-4 grid gap-3">
                {concerns.map((c) => {
                  const img = lifestyleImage(c.slug)
                  return (
                    <li key={c.slug} className="flex items-center gap-4 rounded-full bg-paper p-2 pr-6 shadow-[0_18px_40px_-30px_rgb(40_30_20/0.45)]">
                      <span className="relative size-20 shrink-0 sm:size-24">
                        <span className="absolute inset-0 overflow-hidden rounded-full">
                          <Image src={img.src} alt="" fill sizes="96px" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
                        </span>
                        <span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-paper text-accent-ink ring-2 ring-paper">
                          <ConcernIcon slug={c.slug} size={17} />
                        </span>
                      </span>
                      <div>
                        <p className="font-display text-[1.25rem] leading-tight">{CONCERN[c.slug]!.name}</p>
                        <p className="mt-1 text-sm leading-snug text-ink-muted">{CONCERN[c.slug]!.focus}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        <Curve className="absolute inset-x-0 -bottom-px text-paper" />
      </section>

      <section className="container-page pt-10 pb-16 md:pt-14 md:pb-20" aria-labelledby="rutina-manana">
        <RoutineHeader moment="AM" count={am.length} />
        <RoutineSteps steps={am} byId={byId} moment="AM" />
      </section>

      <section className="relative" aria-labelledby="rutina-noche">
        <Curve className="text-night-deep" />
        <div className="bg-night-deep text-paper">
          <div className="container-page pt-8 pb-16 md:pb-20">
            <RoutineHeader moment="PM" count={pm.length} />
            <RoutineSteps steps={pm} byId={byId} moment="PM" />

            {result.routine.notes.length > 0 && (
              <aside className="mx-auto mt-10 flex max-w-3xl gap-4 rounded-[1.75rem] bg-paper/6 p-5 text-[0.9375rem] leading-relaxed ring-1 ring-paper/12">
                <IconBadge size="sm" tone="night">
                  <Info size={18} />
                </IconBadge>
                <div>
                  <p className="font-medium">Sobre las combinaciones</p>
                  {result.routine.notes.map((n) => (
                    <p key={n} className="mt-1 text-paper/75">
                      {n}
                    </p>
                  ))}
                </div>
              </aside>
            )}

            <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-6 rounded-[2rem] bg-paper p-6 text-ink sm:flex-row sm:items-center sm:justify-between md:p-8">
              <div>
                <p className="text-sm text-ink-muted">Total de la rutina · {unique.length} productos</p>
                <p className="tabular mt-1 font-display text-display-md">{formatARS(totalCents)}</p>
                <p className="mt-2 max-w-sm text-[0.8125rem] text-ink-muted">Precios de ejemplo. Lo que usás de mañana y de noche se cuenta una sola vez.</p>
              </div>
              <AddToCartButton count={unique.length} label="Agregar rutina completa" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
        <Curve className="text-night-deep" flip />
      </section>

      <section className="container-page mt-10">
        <details className="group rounded-[2rem] border border-line bg-paper">
          <summary className="flex items-center justify-between gap-6 p-6 md:p-8">
            <span className="flex items-center gap-4">
              <IconBadge size="lg">
                <Bulb size={24} />
              </IconBadge>
              <span>
              <span className="block font-display text-display-sm">Por qué esta rutina</span>
              <span className="mt-1 block text-[0.9375rem] text-ink-muted">Lo que dedujimos de tus respuestas y cómo elegimos cada producto.</span>
              </span>
            </span>
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong">
              <ChevronDown size={18} className="chevron" />
            </span>
          </summary>
          <div className="grid gap-10 border-t border-line p-6 md:grid-cols-2 md:p-8">
            <div>
              <h3 className="text-sm font-medium text-ink-muted">Lo que entendimos</h3>
              <p className="mt-3 font-display text-[1.4rem] leading-snug">{understood}</p>
              <dl className="mt-6 space-y-3">
                {attributeRows.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <dt className="text-ink-soft">{ATTRIBUTE_LABEL[key]}</dt>
                    <dd className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${(value / maxScore) * 100}%` }} />
                    </dd>
                    <dd className="tabular text-right text-ink-muted">{value} pts</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink-muted">Cómo elegimos cada producto</h3>
              <ol className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                {[
                  'Para cada paso buscamos los productos de ese tipo que se usan en ese momento del día.',
                  `Descartamos los que no se recomiendan para piel ${skin.name.toLowerCase()}${interp.sensitive ? ' y los que llevan activos que suelen irritar' : ''}.`,
                  `Puntuamos cada uno según cuánto trabaja sobre ${concerns.map((c) => CONCERN[c.slug]!.name.toLowerCase()).join(' y ') || 'lo que querés mejorar'}, y según qué tan adecuado es para tu tipo de piel.`,
                  'Revisamos las combinaciones: si dos activos no van juntos, los separamos en noches alternas o entre la mañana y la noche.',
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-shell text-xs font-medium text-ink">{i + 1}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-xl bg-shell p-4 text-sm leading-relaxed text-ink-muted">
                Reglas versión {result.ruleVersion}.{' '}
                {result.stored
                  ? 'Tus respuestas se guardan aparte del resultado: si las reglas cambian, se puede recalcular sin volver a preguntarte nada.'
                  : 'El link lleva tus respuestas: con las mismas reglas, cualquier dispositivo arma exactamente la misma rutina.'}
              </p>
            </div>
          </div>
        </details>
      </section>

      <section className="container-page mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">
          Este link guarda tu resultado: si lo abrís en otro dispositivo, vas a ver la misma rutina.
        </p>
        <div className="flex flex-wrap gap-3">
          <CopyLinkButton />
          <ButtonLink href="/diagnostico" variant="secondary">
            <Refresh size={18} />
            Rehacer el diagnóstico
          </ButtonLink>
        </div>
      </section>
    </>
  )
}

function RoutineHeader({ moment, count }: { moment: 'AM' | 'PM'; count: number }) {
  const am = moment === 'AM'
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-5">
      <IconBadge size="xl" tone={am ? 'accent' : 'night'}>
        {am ? <Sun size={30} /> : <Moon size={28} />}
      </IconBadge>
      <div>
        <h2 id={am ? 'rutina-manana' : 'rutina-noche'} className="font-display text-display-md">
          {am ? 'Tu rutina de mañana' : 'Tu rutina de noche'}
        </h2>
        <p className={`mt-1 text-[0.9375rem] ${am ? 'text-ink-muted' : 'text-paper/65'}`}>
          {count} pasos · {am ? 'para empezar el día con la piel protegida' : 'para tratar y reparar mientras dormís'}
        </p>
      </div>
    </div>
  )
}

/** Steps as a timeline: the step icon on the line, the product card beside it. */
function RoutineSteps({ steps, byId, moment }: { steps: RoutineStep[]; byId: Map<string, CatalogProduct>; moment: 'AM' | 'PM' }) {
  const dark = moment === 'PM'
  return (
    <ol className="relative mx-auto mt-10 max-w-3xl space-y-5">
      <span aria-hidden="true" className={`absolute top-8 bottom-8 left-7 border-l border-dashed sm:left-8 ${dark ? 'border-paper/20' : 'border-line-strong'}`} />
      {steps.map((step, i) => {
        const p = byId.get(step.productId)!
        return (
          <li key={step.productId} className="relative grid grid-cols-[3.5rem_1fr] gap-3 sm:grid-cols-[4rem_1fr] sm:gap-5">
            <span className="relative pt-3">
              <span
                className={`grid size-14 place-items-center rounded-full sm:size-16 ${
                  dark ? 'bg-night-deep text-paper ring-1 ring-paper/20' : 'bg-paper text-ink shadow-[0_10px_24px_-16px_rgb(40_30_20/0.5)] ring-1 ring-line'
                }`}
              >
                <StepIcon type={step.stepType} size={26} />
              </span>
              <span
                className={`tabular absolute top-1 -right-1 grid size-6 place-items-center rounded-full text-[0.75rem] font-medium ${
                  dark ? 'bg-paper text-ink' : 'bg-ink text-paper'
                }`}
              >
                {i + 1}
              </span>
            </span>
            <article className={`grid grid-cols-[5rem_1fr] gap-4 rounded-[1.75rem] p-4 sm:grid-cols-[7rem_1fr] sm:gap-6 sm:p-5 ${dark ? 'bg-paper/6 ring-1 ring-paper/10' : 'bg-shell'}`}>
              <Link href={`/producto/${p.slug}`} tabIndex={-1} aria-hidden="true" className="self-start">
                <ProductImage slug={p.slug} name={p.name} sizes="(min-width: 640px) 112px, 80px" rounded="shape-arch" />
              </Link>
              <div className="min-w-0">
                <p className={`text-[0.8125rem] font-medium ${dark ? 'text-paper/65' : 'text-ink-muted'}`}>
                  Paso {i + 1} · {STEP[step.stepType]?.name}
                </p>
                <h3 className="mt-1.5 font-display text-[1.3rem] leading-tight">
                  <Link href={`/producto/${p.slug}`} className="hover:underline hover:underline-offset-4">
                    {p.name}
                  </Link>
                </h3>
                <p className={`tabular mt-1 text-sm ${dark ? 'text-paper/70' : 'text-ink-soft'}`}>
                  {p.brand.name} · {formatARS(p.priceCents)} · {p.sizeLabel}
                </p>
                <p className={`mt-3 text-[0.9375rem] leading-relaxed ${dark ? 'text-paper/85' : 'text-ink-soft'}`}>{step.explanation}</p>
                {step.frequency && (
                  <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-[0.8125rem] leading-snug ${dark ? 'bg-paper/10 text-paper' : 'bg-paper'}`}>
                    {step.frequency}
                  </p>
                )}
                {step.conflictNote && (
                  <p className={`mt-2 flex gap-2 text-sm leading-snug ${dark ? 'text-accent' : 'text-accent-ink'}`}>
                    <Alert size={16} className="mt-0.5 shrink-0" />
                    {step.conflictNote}
                  </p>
                )}
              </div>
            </article>
          </li>
        )
      })}
    </ol>
  )
}
