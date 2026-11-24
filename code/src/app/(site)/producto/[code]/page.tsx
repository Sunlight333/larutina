import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import {
  Alert,
  ArrowRight,
  Award,
  Bulb,
  Chat,
  Check,
  ChevronDown,
  ConcernIcon,
  Droplet,
  FaceScan,
  Flask,
  Hand,
  IconBadge,
  Info,
  Layers,
  Leaf,
  Moon,
  ShieldCheck,
  Sparkle,
  Star,
  StepIcon,
  Sun,
} from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { Breadcrumb } from '@/components/catalog/page-intro'
import { ProductGrid } from '@/components/catalog/product-grid'
import { Gallery } from '@/components/catalog/pdp/gallery'
import { BuyBox } from '@/components/catalog/pdp/buy-box'
import { FavoriteButton } from '@/components/account/favorite-button'
import { getDb } from '@/server/db'
import { productReviews } from '@/server/commerce/aftersale'
import { currentCustomer } from '@/server/customers/session'
import { isFavorite } from '@/server/customers/history'
import { signInHref } from '@/lib/return-path'
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

/** A section of the product page as the design draws it: the title with its icon on the left, the content on the right. */
function Block({ title, id, icon, children }: { title: string; id: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid scroll-mt-24 gap-5 border-t border-line py-10 md:grid-cols-[13rem_1fr] md:gap-12 md:py-14 lg:grid-cols-[16rem_1fr]">
      <h2 id={id} className="flex items-center gap-3 font-display text-display-sm md:flex-col md:items-start md:gap-4">
        <IconBadge size="lg">{icon}</IconBadge>
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

const Paragraphs = ({ items, className = '' }: { items: string[]; className?: string }) => (
  <div className={`space-y-3 text-[1rem] leading-relaxed text-ink-soft ${className}`}>
    {items.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
)

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pl-1 pr-3">
      <IconBadge size="sm" tone="paper" className="size-7">
        {icon}
      </IconBadge>
      {children}
    </li>
  )
}

// PDP-01..03 and the CAT display fields (F-01 to F-26), in the approved
// design's product page: photo and buying on top, then one section per
// subject with its icon. Reviews (F-06, F-22) show only from the configured
// minimum of approved ones (PDP-07). Not here on purpose: endorsements, whose
// table exists but whose block stays hidden (CAT-21).
export default async function ProductPage({ params, searchParams }: Props) {
  const p = await load((await params).code, wantsPreview(await searchParams))
  if (!p) notFound()
  const s = await getSettings()
  const wa = s['company.whatsappActive'] ? whatsappLink(s['company.whatsapp'], `Hola, tengo una duda sobre ${p.name}`) : null
  const [sameLine, ...relationCards] = await Promise.all([toCards(p.sameLine?.items ?? []), ...p.relations.map((r) => toCards(r.items))])
  const main = p.images[0]
  const size = p.variants[0]?.sizeLabel
  const db = getDb()
  const customer = await currentCustomer()
  const [saved, reviews] = await Promise.all([
    customer && p.published ? isFavorite(db, customer.id, p.id) : false,
    productReviews(db, p.id, s['catalog.reviewsMinimum']),
  ])
  const here = `/producto/${p.code}`

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(p.jsonLd) }} />
      {p.banner && (
        <div className="bg-night-soft px-4 py-2.5 text-center text-sm text-night" role="note">
          {p.banner}
        </div>
      )}
      <div className="container-page pt-5">
        <Breadcrumb items={p.breadcrumb} />
      </div>

      {/* Photos, name, price and buying; what it is for and its star ingredients. */}
      <section className="container-page mt-5 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Gallery images={p.images} video={p.video} name={p.name} step={p.routineStep} brand={p.brand.name} />
        </div>

        <div className="lg:pt-2">
          <Link href={`/marca/${p.brand.code}`} className="text-[0.9375rem] font-medium text-ink-soft hover:text-ink">
            {p.brand.name}
          </Link>
          <h1 className="mt-2 font-display text-display-md text-balance">{p.name}</h1>
          {p.headline && <p className="mt-3 text-lede text-ink-soft">{p.headline}</p>}

          <ul className="mt-4 flex flex-wrap gap-2 text-[0.8125rem]" aria-label="Características">
            <Pill icon={<StepIcon type={p.routineStep} size={15} />}>
              {p.stepLabel}
              {size && ` · ${size}`}
            </Pill>
            {p.texture && <Pill icon={<Droplet size={15} />}>{p.texture}</Pill>}
            <Pill icon={p.moment === 'PM' ? <Moon size={14} /> : <Sun size={15} />}>{p.momentLabel}</Pill>
            {p.seals.map((seal) => (
              <Pill key={seal} icon={seal === 'Vegano' ? <Leaf size={15} /> : <ShieldCheck size={15} />}>
                {seal}
              </Pill>
            ))}
            {p.labels.map((l) => (
              <li key={l} className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 font-medium text-accent-ink">
                {l}
              </li>
            ))}
            {p.chips.map((c) => (
              <li key={c} className="inline-flex items-center rounded-full border border-line-strong px-3 py-1">
                {c}
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-line pt-6">
            <BuyBox
              product={{ name: p.name, brand: p.brand.name, routineStep: p.routineStep, image: main ? { src: main.src, width: main.width, height: main.height } : null }}
              variants={p.variants}
              presale={p.presale}
              published={p.published}
              rating={reviews.show && reviews.average ? { average: reviews.average, count: reviews.count } : null}
              installments={s['commerce.installmentsText'].trim()}
              email={customer?.email}
              favorite={p.published ? <FavoriteButton productId={p.id} saved={saved} signedIn={!!customer} signInHref={signInHref(here, { save: p.code })} /> : undefined}
            />
          </div>

          {p.baseProduct && (
            <p className="mt-4 text-sm text-ink-soft">
              Es el tamaño de viaje de{' '}
              <Link href={`/producto/${p.baseProduct.code}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
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

          {p.shortDescription.length > 0 && (
            <div className="mt-8 space-y-3 text-lede text-ink-soft">
              {p.shortDescription.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          )}

          {(p.concerns.length > 0 || p.skinTypes.length > 0) && (
            <div className="mt-6">
              <h2 className="sr-only">Para qué sirve</h2>
              {p.concerns.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Necesidades">
                  {p.concerns.map((c) => (
                    <li key={c.code}>
                      <Link href={`/necesidad/${c.code}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm hover:border-ink">
                        <ConcernIcon slug={c.code} size={16} className="text-accent-ink" />
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {p.skinTypes.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-ink-muted">
                  {p.skinTypes.map((g) => (
                    <li key={g.aptitude} className={g.aptitude === 'NOT_RECOMMENDED' ? 'text-accent-ink' : ''}>
                      {g.label} para piel {joinEs(g.names)}.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {p.stars.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-medium">Ingredientes estrella</h2>
              <div className="mt-3 border-t border-line">
                {p.stars.map((i) =>
                  i.description ? (
                    <details key={i.code} className="group border-b border-line">
                      <summary className="flex items-center justify-between gap-4 py-4">
                        <StarName star={i} />
                        <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
                      </summary>
                      <p className="pb-4 text-[0.9375rem] leading-relaxed text-ink-soft">{i.description}</p>
                      {i.href && (
                        <Link href={i.href} className="-mt-1 mb-5 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                          Más sobre {lowerFirst(i.name)} <ArrowRight size={14} />
                        </Link>
                      )}
                    </details>
                  ) : (
                    <div key={i.code} className="border-b border-line py-4">
                      <StarName star={i} />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* One section per subject. */}
      <div className="container-page mt-16 md:mt-24">
        {p.whyWeChose.length > 0 && (
          <Block title="Por qué lo elegimos" id="por-que" icon={<Bulb size={22} />}>
            <div className="max-w-2xl space-y-4 font-display text-[1.45rem] leading-[1.4] text-ink md:text-[1.6rem]">
              {p.whyWeChose.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </Block>
        )}

        {p.benefits.length > 0 && (
          <Block title="Beneficios" id="beneficios" icon={<Sparkle size={22} />}>
            <ul className="max-w-2xl space-y-3">
              {p.benefits.map((b, i) => (
                <li key={i} className="flex gap-3 text-[1rem] leading-relaxed">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-sage-soft text-sage-ink">
                    <Check size={14} />
                  </span>
                  <span>
                    {b.verb && <strong className="font-medium">{b.verb}: </strong>}
                    <span className="text-ink-soft">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {p.description.length > 0 && (
          <Block title="Conocelo mejor" id="conocelo" icon={<Info size={22} />}>
            <Paragraphs items={p.description} className="max-w-2xl" />
          </Block>
        )}

        {(p.texture || p.textureDescription.length > 0 || p.tips.length > 0) && (
          <Block title="Textura" id="textura" icon={<Droplet size={22} />}>
            <div className="max-w-2xl">
              {p.texture && <p className="font-display text-[1.35rem] leading-tight">{p.texture}</p>}
              {p.textureDescription.length > 0 && <Paragraphs items={p.textureDescription} className="mt-3" />}
              {p.tips.length > 0 && (
                <div className="mt-6 rounded-[1.75rem] bg-shell p-5 sm:p-6">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Sparkle size={16} /> Tips
                  </p>
                  <Paragraphs items={p.tips} className="mt-2 text-[0.9375rem]" />
                </div>
              )}
            </div>
          </Block>
        )}

        <Block title="Modo de uso" id="rutina" icon={<Hand size={22} />}>
          <div className="max-w-2xl">
            <ul className="flex flex-wrap gap-2" aria-label="Momento del día">
              <MomentMark on={p.moment !== 'PM'} icon={<Sun size={16} />} label="Mañana" />
              <MomentMark on={p.moment !== 'AM'} icon={<Moon size={15} />} label="Noche" />
            </ul>
            {p.howToUse.length > 0 && <Paragraphs items={p.howToUse} className="mt-4" />}
            <div className="mt-8">
              <p className="text-sm text-ink-muted">Dónde va en tu rutina</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink py-1.5 pl-2 pr-3 text-sm font-medium text-paper">
                <StepIcon type={p.routineStep} size={15} />
                {p.stepLabel}
              </p>
            </div>
          </div>
        </Block>

        <Block title="Precauciones" id="precauciones" icon={<ShieldCheck size={22} />}>
          <div className="max-w-2xl">
            <Paragraphs items={p.precautions.text} />
            {p.precautions.warnings.length > 0 && (
              <ul className="mt-6 space-y-3">
                {p.precautions.warnings.map((w) => (
                  <li key={w} className="flex gap-3 rounded-2xl bg-accent-soft/70 p-4 text-[0.9375rem]">
                    <Alert size={18} className="mt-0.5 shrink-0 text-accent-ink" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            {p.precautions.conflicts.length > 0 && (
              <>
                <h3 className="mt-8 text-sm font-medium">Con qué no combinarlo</h3>
                <ul className="mt-3 space-y-3">
                  {p.precautions.conflicts.map((c) => (
                    <li key={c.note} className="flex gap-3 rounded-2xl bg-accent-soft/70 p-4 text-[0.9375rem]">
                      <Alert size={18} className="mt-0.5 shrink-0 text-accent-ink" />
                      <div>
                        <p className="font-medium">Con {joinEs(c.with)}</p>
                        <p className="mt-1 text-ink-soft">{c.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Block>

        {p.kit.length > 0 && (
          <Block title="Qué trae el kit" id="kit" icon={<Layers size={22} />}>
            <ul className="max-w-2xl divide-y divide-line border-y border-line">
              {p.kit.map((k, i) => (
                <li key={i} className="flex justify-between gap-4 py-3 text-[0.9375rem]">
                  {k.href ? (
                    <Link href={k.href} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                      {k.name}
                    </Link>
                  ) : (
                    <span>{k.name}</span>
                  )}
                  <span className="shrink-0 text-ink-muted">{k.sizeLabel}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {p.routines.length > 0 && (
          <Block title="Aparece en estas rutinas" id="rutinas" icon={<Layers size={22} />}>
            <p className="max-w-2xl text-[1rem] leading-relaxed text-ink-soft">Está en {p.routines.length === 1 ? 'una' : p.routines.length} de nuestras rutinas armadas.</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {p.routines.map((r) => (
                <li key={r.code}>
                  <Link href={`/rutinas#${r.code}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm hover:border-ink">
                    {r.name} <ArrowRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {sameLine.length > 0 && p.sameLine && (
          <Block title="De la misma línea" id="misma-linea" icon={<Sparkle size={22} />}>
            <p className="mb-6 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">{p.sameLine.name}</p>
            <ProductGrid products={sameLine} columns={3} />
          </Block>
        )}
        {p.relations.map((r, i) => (
          <Block key={r.kind} title={r.title} id={`rel-${r.kind.toLowerCase()}`} icon={<Sparkle size={22} />}>
            {r.text && <p className="mb-6 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">{r.text}</p>}
            <ProductGrid products={relationCards[i] ?? []} columns={3} />
          </Block>
        ))}

        {p.evaluation && (
          <Block title="Nuestra evaluación" id="evaluacion" icon={<Award size={22} />}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <ScoreRing score={p.evaluation.score} />
              <div className="max-w-xl">
                {p.evaluation.notes && <p className="text-[1rem] leading-relaxed text-ink-soft">{p.evaluation.notes}</p>}
                {p.evaluation.criteria.length > 0 && (
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    {p.evaluation.criteria.map((c) => (
                      <div key={c.name} className="rounded-2xl bg-shell p-4">
                        <dt className="text-sm text-ink-muted">{c.name}</dt>
                        <dd className="mt-1 text-lg tabular">{c.score}/100</dd>
                        {c.note && <dd className="mt-1 text-sm text-ink-soft">{c.note}</dd>}
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </Block>
        )}

        {p.brand.description.length > 0 && (
          <Block title={`Sobre ${p.brand.name}`} id="marca" icon={<Leaf size={22} />}>
            <Paragraphs items={p.brand.description} className="max-w-2xl" />
            <Link href={`/marca/${p.brand.code}`} className="mt-5 inline-flex items-center gap-2 text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
              Ver todos los productos de {p.brand.name} <ArrowRight size={16} />
            </Link>
          </Block>
        )}

        <Reviews reviews={reviews} writeHref={customer ? '/cuenta/pedidos' : signInHref('/cuenta/pedidos')} />

        <IngredientsAndInfo p={p} />

        <aside className="mt-6 grid items-center gap-6 overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:grid-cols-[auto_1fr_auto] sm:p-8" aria-label="Diagnóstico">
          <span className="grid size-14 place-items-center rounded-full bg-paper/10 ring-1 ring-paper/15">
            <FaceScan size={26} />
          </span>
          <p className="font-display text-display-sm">¿No sabés si es para tu piel?</p>
          <ButtonLink href="/diagnostico" variant="inverse" className="justify-self-start sm:justify-self-auto">
            Hacer mi diagnóstico
          </ButtonLink>
        </aside>
      </div>
    </article>
  )
}

/** F-22: average and count, then each review (name, stars, how long she has used it, title and text). Below the minimum, only the invitation. */
function Reviews({ reviews, writeHref }: { reviews: Awaited<ReturnType<typeof productReviews>>; writeHref: string }) {
  return (
    <Block title="Reseñas" id="resenas" icon={<Chat size={22} />}>
      {!reviews.show || !reviews.average ? (
        <p className="max-w-2xl text-[1rem] leading-relaxed text-ink-soft">Todavía no tiene reseñas. Si lo probaste, contanos cómo te fue.</p>
      ) : (
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <p className="flex items-center gap-4">
              <span className="font-display text-[3rem] leading-none tabular">{reviews.average.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span>
                <Stars value={reviews.average} size={20} />
                <span className="mt-1 block text-[0.9375rem] text-ink-soft">{reviews.count} reseñas</span>
              </span>
            </p>
            <ButtonLink href={writeHref} variant="secondary">
              Escribí tu reseña
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {reviews.reviews.map((r, i) => (
              <li key={r.id} className={`bg-shell p-5 sm:p-6 ${i % 2 ? 'rounded-[2rem_1.25rem_2rem_1.25rem]' : 'rounded-[1.25rem_2rem_1.25rem_2rem]'}`}>
                <Stars value={r.rating} size={16} />
                {r.title && <p className="mt-3 font-display text-[1.15rem] leading-snug">{r.title}</p>}
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{r.body}</p>
                <p className="mt-4 text-sm">
                  <span className="font-semibold">{r.authorName}</span>
                  {r.usageTime && <span className="text-ink-muted"> · {r.usageTime}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Block>
  )
}

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${value.toLocaleString('es-AR')} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} filled={Math.max(0, Math.min(1, value - n + 1))} />
      ))}
    </span>
  )
}

function IngredientsAndInfo({ p }: { p: ProductDetail }) {
  if (!p.inci && !p.info.length) return null
  return (
    <Block title={p.inci ? 'Ingredientes completos' : 'Información del producto'} id="ingredientes" icon={<Flask size={22} />}>
      <div className="max-w-2xl">
        {p.inci && (
          <details className="group rounded-[1.75rem] border border-line">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 text-[0.9375rem]">
              <span>
                Ver lista INCI
                {'items' in p.inci && <span className="text-ink-muted"> ({p.inci.items.length} ingredientes)</span>}
              </span>
              <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
            </summary>
            <div className="border-t border-line px-5 py-5">
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                {'items' in p.inci
                  ? p.inci.items.map((it, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {it.star ? (
                          it.href ? (
                            <Link href={it.href} className="font-medium text-ink underline decoration-line-strong underline-offset-4">
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
              <p className="mt-3 text-[0.8125rem] text-ink-muted">En orden de concentración. Los ingredientes estrella, resaltados.</p>
            </div>
          </details>
        )}
        {p.info.length > 0 && (
          <>
            {p.inci && <h3 className="mt-8 text-sm font-medium">Información del producto</h3>}
            <dl className={`${p.inci ? 'mt-3' : ''} divide-y divide-line border-y border-line text-sm`}>
              {p.info.map((row) => (
                <div key={row.label} className="grid grid-cols-[9rem_1fr] items-baseline gap-4 py-3">
                  <dt className="font-medium">{row.label}</dt>
                  <dd className="text-ink-soft">{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Block>
  )
}

function StarName({ star }: { star: ProductDetail['stars'][number] }) {
  return (
    <span className="flex items-center gap-3">
      <IconBadge size="sm">
        <Flask size={17} />
      </IconBadge>
      <span>
        <span className="font-display text-[1.25rem] leading-tight">{star.name}</span>
        {star.concentration && <span className="ml-2 tabular text-sm text-ink-muted">{star.concentration}</span>}
        <span className="block text-xs text-ink-muted">{star.inciName}</span>
      </span>
    </span>
  )
}

function MomentMark({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <li className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${on ? 'border-line-strong' : 'border-line text-ink-muted line-through decoration-line-strong'}`}>
      {icon}
      {label}
      <span className="sr-only">{on ? ': sí' : ': no'}</span>
    </li>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-32 shrink-0" role="img" aria-label={`${score} sobre 100`}>
      <svg viewBox="0 0 100 100" width="128" height="128" className="-rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <p className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
        <span>
          <span className="tabular block font-display text-[2.5rem] leading-none">{score}</span>
          <span className="text-xs text-ink-muted">de 100</span>
        </span>
      </p>
    </div>
  )
}

/** "seca, mixta y sensible". */
function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}
