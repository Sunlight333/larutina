import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { CopyLinkButton } from '@/components/copy-link-button'
import { Alert, ChevronDown, Info, Moon, Refresh, Sun } from '@/components/icons'
import { ProductImage } from '@/components/product-image'
import { ButtonLink } from '@/components/ui/button'
import { CONCERN, SKIN_TYPE, STEP, joinEs } from '@/lib/diagnosis/copy'
import type { RoutineStep } from '@/lib/diagnosis/engine'
import { concernImage } from '@/lib/images'
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
      <section className="border-b border-line bg-shell">
        <div className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-16">
          <div className="animate-rise">
            <p className="eyebrow">Tu diagnóstico</p>
            <p className="mt-8 font-display text-display-sm text-ink-soft italic">Tu piel es</p>
            <h1 className="font-display text-display-xl">{skin.name}</h1>
            {interp.sensitive && result.skinType !== 'sensible' && (
              <p className="mt-4 inline-flex items-center rounded-full border border-line-strong bg-paper px-3 py-1 text-sm">con tendencia sensible</p>
            )}
            <p className="mt-6 max-w-xl text-lede text-ink-soft">{skin.summary}</p>
            {interp.sensitive && (
              <p className="mt-5 flex max-w-xl gap-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                <Info size={20} className="mt-0.5 shrink-0 text-accent-ink" />
                Como tu piel reacciona con facilidad, dejamos afuera el retinol, los ácidos exfoliantes y la vitamina C pura.
              </p>
            )}
          </div>

          {concerns.length > 0 && (
            <div className="animate-rise [animation-delay:120ms]">
              <h2 className="eyebrow">En qué nos vamos a enfocar</h2>
              <ul className="mt-4 grid gap-3">
                {concerns.map((c) => {
                  const img = concernImage(c.slug)
                  return (
                    <li key={c.slug} className="flex items-center gap-4 rounded-2xl bg-paper p-3 pr-5 shadow-[0_1px_0_var(--color-line)]">
                      {img && (
                        <Image
                          src={img.src}
                          alt=""
                          width={72}
                          height={72}
                          placeholder="blur"
                          blurDataURL={img.blur}
                          className="size-16 shrink-0 rounded-xl object-cover sm:size-[4.5rem]"
                        />
                      )}
                      <div>
                        <p className="font-medium">{CONCERN[c.slug]!.name}</p>
                        <p className="mt-0.5 text-sm leading-snug text-ink-muted">{CONCERN[c.slug]!.focus}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="container-page py-14 md:py-20" aria-labelledby="rutina">
        <p className="eyebrow">{interp.steps === 'complete' ? 'Rutina completa' : 'Rutina de tres pasos'}</p>
        <h2 id="rutina" className="mt-3 max-w-2xl font-display text-display-md text-balance">
          Paso por paso, con el motivo de cada producto
        </h2>

        <div className="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-12">
          <RoutineColumn moment="AM" steps={am} byId={byId} />
          <RoutineColumn moment="PM" steps={pm} byId={byId} />
        </div>

        {result.routine.notes.length > 0 && (
          <aside className="mt-10 flex gap-3 rounded-2xl border border-line bg-paper p-5 text-[0.9375rem] leading-relaxed">
            <Info size={20} className="mt-0.5 shrink-0 text-accent-ink" />
            <div>
              <p className="font-medium">Sobre las combinaciones</p>
              {result.routine.notes.map((n) => (
                <p key={n} className="mt-1 text-ink-soft">{n}</p>
              ))}
            </div>
          </aside>
        )}
      </section>

      <section className="container-page" aria-label="Total de la rutina">
        <div className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-ink p-6 text-paper sm:flex-row sm:items-center sm:justify-between md:p-9">
          <div>
            <p className="text-sm text-paper/70">
              Total de la rutina · {unique.length} productos
            </p>
            <p className="tabular mt-1 font-display text-display-md">{formatARS(totalCents)}</p>
            <p className="mt-2 max-w-md text-sm text-paper/60">
              Precios de ejemplo. Lo que usás de mañana y de noche se cuenta una sola vez.
            </p>
          </div>
          <AddToCartButton count={unique.length} label="Agregar rutina completa" variant="inverse" className="w-full sm:w-auto" />
        </div>
      </section>

      <section className="container-page mt-10">
        <details className="group rounded-[var(--radius-card)] border border-line bg-paper">
          <summary className="flex items-center justify-between gap-6 p-6 md:p-8">
            <span>
              <span className="block font-display text-display-sm">Por qué esta rutina</span>
              <span className="mt-1 block text-[0.9375rem] text-ink-muted">Lo que dedujimos de tus respuestas y cómo elegimos cada producto.</span>
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
                Reglas versión {result.ruleVersion}. Tus respuestas se guardan aparte del resultado: si las reglas cambian, se puede recalcular sin
                volver a preguntarte nada.
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

function RoutineColumn({ moment, steps, byId }: { moment: 'AM' | 'PM'; steps: RoutineStep[]; byId: Map<string, CatalogProduct> }) {
  const am = moment === 'AM'
  return (
    <div>
      <div className="flex items-center gap-4 border-b border-ink pb-5">
        <span className={`grid size-11 place-items-center rounded-full ${am ? 'bg-accent-soft text-accent-ink' : 'bg-night-soft text-night'}`}>
          {am ? <Sun size={22} /> : <Moon size={21} />}
        </span>
        <div>
          <h3 className="font-display text-display-sm">{am ? 'Tu rutina de mañana' : 'Tu rutina de noche'}</h3>
          <p className="text-sm text-ink-muted">{steps.length} pasos</p>
        </div>
      </div>
      <ol>
        {steps.map((step, i) => {
          const p = byId.get(step.productId)!
          return (
            <li key={step.productId} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[7rem_1fr] sm:gap-6">
              <Link href={`/producto/${p.slug}`} tabIndex={-1} aria-hidden="true" className="self-start">
                <ProductImage slug={p.slug} name={p.name} sizes="(min-width: 640px) 112px, 88px" rounded="rounded-xl" />
              </Link>
              <div className="min-w-0">
                <p className="flex items-center gap-2.5 text-sm">
                  <span className="tabular grid size-6 place-items-center rounded-full bg-ink text-[0.75rem] font-medium text-paper">{i + 1}</span>
                  <span className="font-medium">{STEP[step.stepType]?.name}</span>
                </p>
                <p className="mt-3 text-[0.8125rem] text-ink-muted">{p.brand.name}</p>
                <h4 className="font-display text-[1.3rem] leading-tight">
                  <Link href={`/producto/${p.slug}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-4">
                    {p.name}
                  </Link>
                </h4>
                <p className="tabular mt-1 text-sm text-ink-soft">
                  {formatARS(p.priceCents)} · {p.sizeLabel}
                </p>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{step.explanation}</p>
                {step.frequency && (
                  <p className="mt-3 inline-flex rounded-full bg-shell px-3 py-1 text-[0.8125rem] leading-snug">{step.frequency}</p>
                )}
                {step.conflictNote && (
                  <p className="mt-2 flex gap-2 text-sm leading-snug text-accent-ink">
                    <Alert size={16} className="mt-0.5 shrink-0" />
                    {step.conflictNote}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
