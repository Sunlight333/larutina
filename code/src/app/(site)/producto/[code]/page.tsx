import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { Alert, ArrowRight, Chat, Check, Info, Leaf, Moon, ShieldCheck, Sun } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { Breadcrumb } from '@/components/catalog/page-intro'
import { ProductGrid } from '@/components/catalog/product-grid'
import { Gallery } from '@/components/catalog/pdp/gallery'
import { BuyBox } from '@/components/catalog/pdp/buy-box'
import { getSettings } from '@/server/settings'
import { toCards } from '@/server/services/catalog/cards'
import { getProductDetail, type ProductDetail } from '@/server/services/catalog/product'
import { lowerFirst } from '@/server/services/catalog/rules'
import { jsonLd } from '@/server/services/catalog/seo'
import { catalogViewer } from '@/server/services/catalog/viewer'
import { whatsappLink } from '@/lib/whatsapp'

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const load = cache(async (code: string, preview: boolean) => {
  const viewer = await catalogViewer()
  if (!viewer.canSee) return null
  return getProductDetail(code, viewer, { preview })
})

const wantsPreview = (sp: Record<string, string | string[] | undefined>) => sp['vista-previa'] === '1'

// F-26: seo fields, or "[nombre] · [marca]" (the layout adds the site name).
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const p = await load((await params).code, wantsPreview(await searchParams))
  if (!p) return {}
  return {
    title: p.seo.title ? { absolute: p.seo.title } : `${p.name} · ${p.brand.name}`,
    description: p.seo.description || undefined,
    alternates: { canonical: `/producto/${p.code}` },
    robots: p.indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      title: p.seo.title ?? `${p.name} · ${p.brand.name}`,
      description: p.seo.description || undefined,
      url: `/producto/${p.code}`,
      images: p.seo.image ? [{ url: p.seo.image.src, width: p.seo.image.width, height: p.seo.image.height, alt: p.seo.image.alt }] : undefined,
    },
  }
}

function Section({ title, id, children, className = '' }: { title: string; id: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`border-t border-line py-10 ${className}`}>
      <h2 id={id} className="font-display text-display-sm">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const Paragraphs = ({ items, className = '' }: { items: string[]; className?: string }) => (
  <div className={`space-y-3 text-ink-soft ${className}`}>
    {items.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
)

// PDP-01..03 and the CAT display fields, in the content file's order (F-01 to F-26).
// Not here on purpose: reviews (Phase 2, F-06/F-22) and endorsements, whose
// table exists but whose block stays hidden until Phase 2 (CAT-21).
export default async function ProductPage({ params, searchParams }: Props) {
  const p = await load((await params).code, wantsPreview(await searchParams))
  if (!p) notFound()
  const s = await getSettings()
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], `Hola, tengo una duda sobre ${p.name}`) : null
  const [sameLine, ...relationCards] = await Promise.all([toCards(p.sameLine?.items ?? []), ...p.relations.map((r) => toCards(r.items))])
  const main = p.images[0]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(p.jsonLd) }} />
      {p.banner && (
        <div className="bg-night-soft px-4 py-2.5 text-center text-sm text-night" role="note">
          {p.banner}
        </div>
      )}
      <div className="container-page pt-6 sm:pt-8">
        <Breadcrumb items={p.breadcrumb} />
      </div>

      <div className="container-page mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Gallery images={p.images} video={p.video} name={p.name} step={p.routineStep} brand={p.brand.name} />
        </div>

        <div>
          <Link href={`/marca/${p.brand.code}`} className="text-sm font-medium uppercase tracking-wide text-ink-muted hover:text-ink">
            {p.brand.name}
          </Link>
          <h1 className="mt-2 font-display text-display-md text-balance">{p.name}</h1>
          {p.headline && <p className="mt-3 text-lede text-ink-soft">{p.headline}</p>}

          {(p.labels.length > 0 || p.chips.length > 0) && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Características">
              {p.labels.map((l) => (
                <li key={l} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
                  {l}
                </li>
              ))}
              {p.chips.map((c) => (
                <li key={c} className="rounded-full border border-line-strong px-3 py-1 text-xs">
                  {c}
                </li>
              ))}
            </ul>
          )}

          {p.seals.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-sage-ink" aria-label="Sellos">
              {p.seals.map((seal) => (
                <li key={seal} className="flex items-center gap-1.5">
                  {seal === 'Vegano' ? <Leaf size={16} /> : <ShieldCheck size={16} />}
                  {seal}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <BuyBox
              product={{ name: p.name, brand: p.brand.name, routineStep: p.routineStep, image: main ? { src: main.src, width: main.width, height: main.height } : null }}
              variants={p.variants}
              presale={p.presale}
              published={p.published}
            />
          </div>

          {p.baseProduct && (
            <p className="mt-4 text-sm text-ink-soft">
              Es el tamaño de viaje de{' '}
              <Link href={`/producto/${p.baseProduct.code}`} className="underline underline-offset-2">
                {p.baseProduct.name}
              </Link>
              .
            </p>
          )}

          {wa && (
            <a href={wa} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
              <Chat size={18} />
              ¿Dudas? Escribinos
            </a>
          )}

          {p.shortDescription.length > 0 && <Paragraphs items={p.shortDescription} className="mt-8 text-[1.0625rem]" />}

          {(p.concerns.length > 0 || p.skinTypes.length > 0) && (
            <Section title="Para qué sirve" id="para-que-sirve" className="mt-10">
              {p.concerns.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {p.concerns.map((c) => (
                    <li key={c.code}>
                      <Link href={`/necesidad/${c.code}`} className="inline-flex h-9 items-center rounded-full bg-shell px-4 text-sm hover:bg-sand">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {p.skinTypes.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-ink-soft">
                  {p.skinTypes.map((g) => (
                    <li key={g.aptitude} className={g.aptitude === 'NOT_RECOMMENDED' ? 'text-accent-ink' : ''}>
                      <span className="font-medium text-ink">{g.label}</span> para piel {joinEs(g.names)}.
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {p.stars.length > 0 && (
            <Section title="Ingredientes estrella" id="ingredientes-estrella">
              <ul className="divide-y divide-line border-y border-line">
                {p.stars.map((i) => (
                  <li key={i.code}>
                    {i.description ? (
                      <details className="group py-3.5">
                        <summary className="flex items-center justify-between gap-4">
                          <StarName star={i} />
                          <span className="chevron text-ink-muted" aria-hidden="true">
                            ▾
                          </span>
                        </summary>
                        <p className="mt-2 text-sm text-ink-soft">{i.description}</p>
                        {i.href && (
                          <Link href={i.href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
                            Más sobre {lowerFirst(i.name)} <ArrowRight size={14} />
                          </Link>
                        )}
                      </details>
                    ) : (
                      <div className="py-3.5">
                        <StarName star={i} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {p.benefits.length > 0 && (
            <Section title="Beneficios" id="beneficios">
              <ul className="space-y-3">
                {p.benefits.map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-sage-ink" />
                    <span>
                      {b.verb && <strong className="font-medium tracking-wide">{b.verb}: </strong>}
                      <span className="text-ink-soft">{b.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {p.whyWeChose.length > 0 && (
            <Section title="Por qué lo elegimos" id="por-que">
              <Paragraphs items={p.whyWeChose} />
            </Section>
          )}

          {p.description.length > 0 && (
            <Section title="Conocelo mejor" id="conocelo">
              <Paragraphs items={p.description} />
            </Section>
          )}

          {(p.texture || p.textureDescription.length > 0 || p.tips.length > 0) && (
            <Section title="Textura" id="textura">
              {p.texture && <p className="font-medium">{p.texture}</p>}
              {p.textureDescription.length > 0 && <Paragraphs items={p.textureDescription} className="mt-2" />}
              {p.tips.length > 0 && (
                <div className="mt-5 rounded-2xl bg-shell p-4">
                  <p className="text-sm font-medium">Tips</p>
                  <Paragraphs items={p.tips} className="mt-1 text-sm" />
                </div>
              )}
            </Section>
          )}

          <Section title="Dónde va en tu rutina" id="rutina">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <MomentMark on={p.moment !== 'PM'} icon={<Sun size={18} />} label="De mañana" />
              <MomentMark on={p.moment !== 'AM'} icon={<Moon size={18} />} label="De noche" />
            </ul>
            <p className="mt-3 text-sm">
              <span className="text-ink-muted">Paso:</span> {p.stepLabel}
            </p>
            {p.howToUse.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-medium">Modo de uso</h3>
                <Paragraphs items={p.howToUse} className="mt-1" />
              </>
            )}
            <div className="mt-6 rounded-2xl border border-line p-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Info size={16} /> Precauciones
              </h3>
              <Paragraphs items={p.precautions.text} className="mt-2 text-sm" />
              {p.precautions.warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.precautions.warnings.map((w) => (
                    <li key={w} className="flex gap-2">
                      <Alert size={16} className="mt-0.5 shrink-0 text-accent-ink" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              {p.precautions.conflicts.length > 0 && (
                <>
                  <h4 className="mt-4 text-sm font-medium">Con qué no combinarlo</h4>
                  <ul className="mt-1.5 space-y-1.5 text-sm text-ink-soft">
                    {p.precautions.conflicts.map((c) => (
                      <li key={c.note}>
                        <span className="text-ink">Con {joinEs(c.with)}:</span> {c.note}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>

          {p.kit.length > 0 && (
            <Section title="Qué trae el kit" id="kit">
              <ul className="space-y-2">
                {p.kit.map((k, i) => (
                  <li key={i} className="flex justify-between gap-4 text-sm">
                    {k.href ? (
                      <Link href={k.href} className="underline underline-offset-2">
                        {k.name}
                      </Link>
                    ) : (
                      <span>{k.name}</span>
                    )}
                    <span className="shrink-0 text-ink-muted">{k.sizeLabel}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {p.routines.length > 0 && (
            <Section title="Aparece en estas rutinas" id="rutinas">
              <p className="text-ink-soft">
                Está en {p.routines.length === 1 ? 'una' : p.routines.length} de nuestras rutinas armadas:{' '}
                {p.routines.map((r, i) => (
                  <span key={r.code}>
                    {i > 0 && ' · '}
                    <Link href={`/rutinas#${r.code}`} className="text-ink underline underline-offset-2">
                      {r.name}
                    </Link>
                  </span>
                ))}
              </p>
            </Section>
          )}
        </div>
      </div>

      <div className="container-page">
        {sameLine.length > 0 && p.sameLine && (
          <Section title="De la misma línea" id="misma-linea" className="mt-14">
            <p className="-mt-3 mb-6 text-sm text-ink-muted">{p.sameLine.name}</p>
            <ProductGrid products={sameLine} />
          </Section>
        )}
        {p.relations.map((r, i) => (
          <Section key={r.kind} title={r.title} id={`rel-${r.kind.toLowerCase()}`} className={i === 0 && !sameLine.length ? 'mt-14' : ''}>
            {r.text && <p className="-mt-3 mb-6 text-sm text-ink-muted">{r.text}</p>}
            <ProductGrid products={relationCards[i] ?? []} />
          </Section>
        ))}

        <section className="mt-14 flex flex-col items-start gap-5 rounded-[var(--radius-card)] bg-shell px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10" aria-label="Diagnóstico">
          <p className="font-display text-display-sm">¿No sabés si es para tu piel?</p>
          <ButtonLink href="/diagnostico">Hacer mi diagnóstico</ButtonLink>
        </section>

        <div className="mt-6 grid gap-x-14 lg:grid-cols-2">
          {p.brand.description.length > 0 && (
            <Section title={`Sobre ${p.brand.name}`} id="marca">
              <Paragraphs items={p.brand.description} />
              <Link href={`/marca/${p.brand.code}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
                Ver todos los productos de {p.brand.name} <ArrowRight size={16} />
              </Link>
            </Section>
          )}
          <IngredientsAndInfo p={p} />
        </div>

        {p.evaluation && (
          <Section title="Nuestra evaluación" id="evaluacion">
            <p className="font-display text-display-md tabular">
              {p.evaluation.score}
              <span className="text-lede text-ink-muted">/100</span>
            </p>
            {p.evaluation.notes && <p className="mt-2 max-w-2xl text-ink-soft">{p.evaluation.notes}</p>}
            {p.evaluation.criteria.length > 0 && (
              <dl className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
                {p.evaluation.criteria.map((c) => (
                  <div key={c.name} className="rounded-2xl bg-shell p-4">
                    <dt className="text-sm text-ink-muted">{c.name}</dt>
                    <dd className="mt-1 text-lg tabular">{c.score}/100</dd>
                    {c.note && <dd className="mt-1 text-sm text-ink-soft">{c.note}</dd>}
                  </div>
                ))}
              </dl>
            )}
          </Section>
        )}
      </div>
    </>
  )
}

function IngredientsAndInfo({ p }: { p: ProductDetail }) {
  if (!p.inci && !p.info.length) return null
  return (
    <section aria-labelledby="ingredientes" className="border-t border-line py-10">
      <h2 id="ingredientes" className="font-display text-display-sm">
        {p.inci ? 'Lista de ingredientes' : 'Información del producto'}
      </h2>
      {p.inci && (
        <details className="mt-5 rounded-2xl border border-line">
          <summary className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span>
              <span className="block font-medium">Ver todos los ingredientes (INCI)</span>
              <span className="block text-sm text-ink-muted">En orden de concentración. Los ingredientes estrella, resaltados.</span>
            </span>
            <span className="chevron text-ink-muted" aria-hidden="true">
              ▾
            </span>
          </summary>
          <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">
            {'items' in p.inci
              ? p.inci.items.map((it, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    {it.star ? (
                      it.href ? (
                        <Link href={it.href} className="font-medium text-ink underline underline-offset-2">
                          {it.name}
                        </Link>
                      ) : (
                        <strong className="font-medium text-ink">{it.name}</strong>
                      )
                    ) : (
                      it.name
                    )}
                  </span>
                ))
              : p.inci.text}
          </p>
        </details>
      )}
      {p.info.length > 0 && (
        <>
          {p.inci && <h3 className="mt-8 text-sm font-medium">Información del producto</h3>}
          <dl className={`${p.inci ? 'mt-3' : 'mt-5'} divide-y divide-line border-y border-line text-sm`}>
            {p.info.map((row) => (
              <div key={row.label} className="flex justify-between gap-6 py-2.5">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}

function StarName({ star }: { star: ProductDetail['stars'][number] }) {
  return (
    <span>
      <span className="font-medium">{star.name}</span>
      {star.concentration && <span className="ml-1.5 tabular text-accent-ink">{star.concentration}</span>}
      <span className="block text-xs text-ink-muted">{star.inciName}</span>
    </span>
  )
}

function MomentMark({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${on ? '' : 'text-ink-muted line-through decoration-line-strong'}`}>
      {icon}
      {label}
      <span className="sr-only">{on ? ': sí' : ': no'}</span>
      {on && <Check size={16} className="text-sage-ink" />}
    </li>
  )
}

/** "seca, mixta y sensible". */
function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}
