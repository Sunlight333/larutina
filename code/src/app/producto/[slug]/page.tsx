import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Alert, ArrowRight, Award, Bulb, Chat, ChevronDown, Droplet, Flask, Hand, IconBadge, Layers, Leaf, Moon, ShieldCheck, Sparkle, Star, StepIcon, Sun } from '@/components/icons'
import { ProductCard } from '@/components/product-card'
import { ProductImage } from '@/components/product-image'
import { sampleReviews } from '@/content/sample-reviews'
import { routineCoverage, summariseCoverage } from '@/lib/catalog/coverage'
import { pairings, productConflicts } from '@/lib/catalog/pairings'
import { ConcernIcon } from '@/components/icons'
import { CONCERN, SKIN_TYPE, STEP, joinEs, lowerFirst, type StepType } from '@/lib/diagnosis/copy'
import { featuredActives, TEMPLATES } from '@/lib/diagnosis/engine'
import { faceCrop, lifestyleImage, productImage, type LifestyleName } from '@/lib/images'
import { formatARS } from '@/lib/money'
import { getCatalog, getProductSlugs, toEngineConflicts, toEngineProduct } from '@/server/services/catalog'

export const dynamicParams = false

export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { products } = await getCatalog()
  const p = products.find((x) => x.slug === slug)
  if (!p) return {}
  const img = productImage(p.slug)
  return {
    title: `${p.name} · ${p.brand.name}`,
    description: p.shortDescription,
    openGraph: img ? { images: [{ url: img.src, width: img.width, height: img.height, alt: p.name }] } : undefined,
  }
}

const SEVERITY_LABEL: Record<string, string> = {
  ALTERNATE_DAYS: 'En noches alternas con',
  CAUTION: 'En otro momento del día que',
  AVOID: 'No combinar con',
}

// Campaign images that show a given product in use, with the crop that keeps
// the model and the product in frame.
// The campaign photograph each product appears in. Products shot only in a
// group photograph zoom onto the model holding them (focus, as fractions).
const IN_USE: Record<string, { image: LifestyleName; focus?: [number, number]; zoom?: number }> = {
  'serum-vitamina-c-15': { image: 'hero-1', focus: [0.585, 0.36], zoom: 2 },
  'crema-reparadora-barrera': { image: 'hero-1', focus: [0.855, 0.36], zoom: 2 },
  'serum-acido-hialuronico': { image: 'hero-2', focus: [0.64, 0.52], zoom: 2 },
  'exfoliante-bha-2': { image: 'acne' },
  'serum-acido-azelaico-10': { image: 'manchas' },
  'tonico-hidratante': { image: 'deshidratacion' },
  'tonico-calmante-centella': { image: 'sensibilidad' },
  'crema-con-peptidos': { image: 'lineas' },
  'mascarilla-de-arcilla': { image: 'poros' },
  'fluido-protector-fps-50': { image: 'manana' },
  'retinol-03-escualano': { image: 'noche' },
  'serum-niacinamida-10-zinc': { image: 'ficha' },
  'gel-crema-ligero': { image: 'diagnostico' },
}

const CONCERN_SHORT: Record<string, string> = {
  acne: 'acné',
  manchas: 'manchas',
  deshidratacion: 'hidratación',
  sensibilidad: 'rojeces',
  lineas: 'líneas finas',
  poros: 'poros',
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const { products, conflicts, concerns } = await getCatalog()
  const product = products.find((p) => p.slug === slug)
  if (!product) notFound()

  const engineProducts = products.map(toEngineProduct)
  const engineConflicts = toEngineConflicts(conflicts)
  const target = engineProducts.find((p) => p.id === product.id)!
  const bySlug = new Map(products.map((p) => [p.id, p]))
  const concernBySlug = new Map(concerns.map((c) => [c.slug, c]))

  // Block 3
  const mainConcerns = product.concerns.filter((c) => c.relevance >= 50)
  const idealSkins = product.skinTypes.filter((s) => s.suitability === 'IDEAL').map((s) => s.skinType.slug)
  const avoidSkins = product.skinTypes.filter((s) => s.suitability === 'NOT_RECOMMENDED').map((s) => s.skinType.slug)
  const skinName = (s: string) => SKIN_TYPE[s]?.name.toLowerCase() ?? s
  const idealLine = idealSkins.length === 5 ? 'Para todo tipo de piel' : `Ideal para piel ${joinEs(idealSkins.map(skinName))}`

  // Block 4
  const descriptions = new Map(product.ingredients.map((pi) => [pi.ingredient.slug, pi.ingredient.description]))
  const actives = featuredActives(target.ingredients).slice(0, 3)

  // Block 7
  const slot: 'AM' | 'PM' = product.routineMoment === 'PM' ? 'PM' : 'AM'
  const placement = TEMPLATES.complete[slot].map((spec) => ({
    label: spec.types.includes('TREATMENT') ? STEP.TREATMENT.name : STEP[spec.types[0] as StepType].name,
    type: spec.types.includes('TREATMENT') ? 'TREATMENT' : (spec.types[0] as StepType),
    current: spec.types.includes(product.routineStepType as StepType),
  }))

  // Blocks 8–10
  const productConflictList = productConflicts(target, engineProducts, engineConflicts)
  const coverage = summariseCoverage(routineCoverage(engineProducts, engineConflicts).byProduct.get(product.id) ?? [])
  // Skin types the product is made for lead the list.
  const coverageSkins = [...coverage.skins].sort(
    (a, b) => Number(!idealSkins.includes(a.skinType)) - Number(!idealSkins.includes(b.skinType)) || b.concerns.length - a.concerns.length,
  )
  const pairs = pairings(target, engineProducts, engineConflicts)
  const pairConcerns = [...new Set(pairs.flatMap((p) => p.sharedConcerns))].slice(0, 3)

  // Blocks 11–12
  const reviews = sampleReviews[product.slug] ?? []
  const inci = product.ingredients.filter((pi) => pi.ingredient.inciName !== '(varios)')

  const img = productImage(product.slug)
  const inUseEntry = IN_USE[product.slug]
  const inUseImage = inUseEntry ? lifestyleImage(inUseEntry.image) : null
  // Group photographs are zoomed onto one model inside the 4:5 arch, so they load at the zoomed width.
  const inUse =
    inUseEntry && inUseImage
      ? inUseEntry.focus
        ? { ...inUseImage, style: faceCrop({ ...inUseImage, face: inUseEntry.focus }, inUseEntry.zoom, 4 / 5), sizes: '(min-width: 768px) 1220px, 400vw' }
        : { ...inUseImage, style: undefined, sizes: '(min-width: 1024px) 272px, (min-width: 768px) 240px, 100vw' }
      : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.slug,
    brand: { '@type': 'Brand', name: product.brand.name },
    image: img?.src,
    offers: {
      '@type': 'Offer',
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: 'ARS',
      availability: 'https://schema.org/InStock',
    },
    // No aggregateRating: the reviews are samples, and marking them up as
    // real would be misleading (plan §7.5).
  }

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav aria-label="Migas de pan" className="container-page pt-5">
        <ol className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
          <li><Link href="/" className="hover:text-ink">Inicio</Link></li>
          <li aria-hidden="true">/</li>
          <li>{STEP[product.routineStepType as StepType]?.name}</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate text-ink-soft">{product.name}</li>
        </ol>
      </nav>

      {/* Blocks 1–4 */}
      <section className="container-page mt-5 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <ProductImage
            slug={product.slug}
            name={`${product.name}, de ${product.brand.name}`}
            sizes="(min-width: 1216px) 600px, (min-width: 1024px) 50vw, 100vw"
            lcp
          />
        </div>

        <div className="lg:pt-2">
          <p className="text-[0.9375rem] font-medium text-ink-soft">{product.brand.name}</p>
          <h1 className="mt-2 font-display text-display-md text-balance">{product.name}</h1>
          <ul className="mt-4 flex flex-wrap gap-2 text-[0.8125rem]" aria-label="Características">
            <li className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pr-3 pl-1">
              <IconBadge size="sm" tone="paper" className="size-7">
                <StepIcon type={product.routineStepType} size={15} />
              </IconBadge>
              {STEP[product.routineStepType as StepType]?.name} · {product.sizeLabel}
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pr-3 pl-1">
              <IconBadge size="sm" tone="paper" className="size-7">
                <Droplet size={15} />
              </IconBadge>
              {product.texture}
            </li>
            {product.fragranceFree && (
              <li className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pr-3 pl-1">
                <IconBadge size="sm" tone="paper" className="size-7">
                  <Leaf size={15} />
                </IconBadge>
                Sin fragancia
              </li>
            )}
            <li className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pr-3 pl-1">
              <IconBadge size="sm" tone="paper" className="size-7">
                {product.routineMoment === 'PM' ? <Moon size={14} /> : <Sun size={15} />}
              </IconBadge>
              {product.routineMoment === 'PM' ? 'De noche' : product.routineMoment === 'AM' ? 'De mañana' : 'Mañana y noche'}
            </li>
          </ul>
          <a href="#resenas" className="mt-4 inline-flex items-center gap-2 text-sm">
            <Stars value={product.avgRating} />
            <span className="tabular font-medium">{product.avgRating.toLocaleString('es-AR')}</span>
            <span className="text-ink-muted underline decoration-line-strong underline-offset-4">{product.reviewCount} reseñas de ejemplo</span>
          </a>

          <div className="mt-6 border-t border-line pt-6">
            <p className="tabular font-display text-[2.25rem] leading-none">{formatARS(product.priceCents)}</p>
            <p className="mt-2 text-[0.8125rem] text-ink-muted">Precio de ejemplo</p>
            <AddToCartButton className="mt-5 w-full" />
          </div>

          <p className="mt-8 text-lede text-ink-soft">{product.shortDescription}</p>

          {/* Block 3 */}
          <div className="mt-6">
            <h2 className="sr-only">Para qué sirve</h2>
            <ul className="flex flex-wrap gap-2" aria-label="Necesidades">
              {mainConcerns.map((c) => (
                <li key={c.concernId}>
                  <Link href={`/productos?necesidad=${c.concern.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm hover:border-ink">
                    <ConcernIcon slug={c.concern.slug} size={16} className="text-accent-ink" />
                    {c.concern.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">
              {idealLine}.{avoidSkins.length > 0 && ` No recomendado para piel ${joinEs(avoidSkins.map(skinName))}.`}
            </p>
          </div>

          {/* Block 4 */}
          <div className="mt-10">
            <h2 className="text-sm font-medium">Activos clave</h2>
            <div className="mt-3 border-t border-line">
              {actives.map((a) => (
                <details key={a.slug} className="group border-b border-line">
                  <summary className="flex items-center justify-between gap-4 py-4">
                    <span className="flex items-center gap-3">
                      <IconBadge size="sm">
                        <Flask size={17} />
                      </IconBadge>
                      <span className="font-display text-[1.25rem] leading-tight">{a.commonName}</span>
                      {a.concentration && <span className="tabular text-sm text-ink-muted">{a.concentration}</span>}
                    </span>
                    <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
                  </summary>
                  <p className="pb-5 text-[0.9375rem] leading-relaxed text-ink-soft">{descriptions.get(a.slug)}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blocks 5–12 */}
      <div className="container-page mt-16 md:mt-24">
        <Block title="Por qué lo elegimos" icon={<Bulb size={22} />}>
          <p className="max-w-2xl font-display text-[1.45rem] leading-[1.4] text-ink md:text-[1.6rem]">{product.whyWeChose}</p>
        </Block>

        <Block title="Nuestra evaluación" icon={<Award size={22} />}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <ScoreRing score={product.ourRating} />
            <div className="max-w-xl">
              <p className="text-[1rem] leading-relaxed text-ink-soft">{product.ratingNotes}</p>
              <p className="mt-3 text-sm text-ink-muted">Puntaje propio sobre 100: eficacia, tolerancia y relación entre precio y resultado.</p>
            </div>
          </div>
        </Block>

        <Block title="Modo de uso" icon={<Hand size={22} />}>
          <div className={inUse ? 'grid gap-8 md:grid-cols-[1fr_15rem] md:gap-10 lg:grid-cols-[1fr_17rem]' : ''}>
          <div className="max-w-2xl">
            <ul className="flex flex-wrap gap-2" aria-label="Momento del día">
              {(product.routineMoment === 'PM' ? ['PM'] : product.routineMoment === 'AM' ? ['AM'] : ['AM', 'PM']).map((m) => (
                <li key={m} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-sm">
                  {m === 'AM' ? <Sun size={16} /> : <Moon size={15} />}
                  {m === 'AM' ? 'Mañana' : 'Noche'}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[1rem] leading-relaxed text-ink-soft">{product.howToUse}</p>
            <div className="mt-8">
              <p className="text-sm text-ink-muted">
                Dónde va en la rutina {slot === 'AM' ? 'de mañana' : 'de noche'}
              </p>
              <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
                {placement.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 ${s.current ? 'bg-ink font-medium text-paper' : 'bg-shell text-ink-muted'}`}
                      aria-current={s.current ? 'step' : undefined}
                    >
                      <StepIcon type={s.type} size={15} />
                      {s.label}
                    </span>
                    {i < placement.length - 1 && <ArrowRight size={14} className="text-line-strong" />}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {inUse && (
            <figure>
              <div className="shape-arch relative aspect-[4/5] overflow-hidden bg-sand">
                <Image src={inUse.src} alt={`${product.name}, en uso`} fill sizes={inUse.sizes} placeholder="blur" blurDataURL={inUse.blur} className="object-cover" style={inUse.style} />
              </div>
              <figcaption className="mt-3 text-center text-[0.8125rem] text-ink-muted">En uso</figcaption>
            </figure>
          )}
          </div>
        </Block>

        <Block title="Precauciones" icon={<ShieldCheck size={22} />}>
          <div className="max-w-2xl">
            {product.precautions && <p className="text-[1rem] leading-relaxed text-ink-soft">{product.precautions}</p>}
            {productConflictList.length > 0 && (
              <ul className="mt-6 space-y-3">
                {productConflictList.map(({ conflict, products: others }) => (
                  <li key={`${conflict.a}-${conflict.b}`} className="flex gap-3 rounded-2xl bg-accent-soft/70 p-4 text-[0.9375rem]">
                    <Alert size={18} className="mt-0.5 shrink-0 text-accent-ink" />
                    <div>
                      <p>
                        <span className="font-medium">{SEVERITY_LABEL[conflict.severity]} </span>
                        {others.map((o, i) => (
                          <span key={o.id}>
                            {i > 0 && (i === others.length - 1 ? ' y ' : ', ')}
                            <Link href={`/producto/${o.slug}`} className="underline decoration-accent/50 underline-offset-4 hover:decoration-accent-ink">
                              {o.name}
                            </Link>
                          </span>
                        ))}
                        .
                      </p>
                      <p className="mt-1 text-ink-soft">{conflict.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Block>

        <Block title="Aparece en estas rutinas" icon={<Layers size={22} />}>
          {coverage.routineCount > 0 ? (
            <div className="max-w-2xl">
              <p className="text-[1rem] leading-relaxed text-ink-soft">
                Sale en rutinas para piel {joinEs(coverageSkins.slice(0, 3).map((s) => skinName(s.skinType)))} con foco en{' '}
                {joinEs(coverage.topConcerns.slice(0, 3).map((c) => CONCERN_SHORT[c] ?? c))}
                {coverage.slots.length === 2 ? ', de mañana y de noche' : coverage.slots[0] === 'AM' ? ', de mañana' : ', de noche'}.
              </p>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {coverageSkins.map((s) => (
                  <div key={s.skinType} className="grid grid-cols-[7rem_1fr] items-baseline gap-4 py-3 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="font-medium">Piel {skinName(s.skinType)}</dt>
                    <dd className="text-ink-soft">{joinEs(s.concerns.map((c) => CONCERN_SHORT[c] ?? c))}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-ink-muted">
                Calculado con las reglas del diagnóstico: aparece en {coverage.routineCount} de las 60 rutinas que puede armar.
              </p>
            </div>
          ) : (
            <p className="max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
              Es un complemento: no ocupa un paso fijo en las rutinas del diagnóstico, pero encaja en rutinas para piel{' '}
              {joinEs(idealSkins.map(skinName))} con foco en {joinEs(mainConcerns.map((c) => CONCERN_SHORT[c.concern.slug] ?? c.concern.name))}.
            </p>
          )}
        </Block>

        {pairs.length > 0 && (
          <Block title="Combina bien con" icon={<Sparkle size={22} />}>
            <p className="mb-6 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
              Productos de otros pasos de la rutina que también trabajan sobre {joinEs(pairConcerns.map((c) => CONCERN[c]?.phrase ?? c))}, y que se
              pueden usar junto con este.
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6">
              {pairs.map(({ product: q }) => {
                const full = bySlug.get(q.id)!
                const qActives = featuredActives(q.ingredients)
                  .slice(0, 2)
                  .map((i) => (i.concentration ? `${lowerFirst(i.commonName)} al ${i.concentration}` : lowerFirst(i.commonName)))
                return (
                  <li key={q.id}>
                    <ProductCard product={full} sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw" note={qActives.length ? `Con ${joinEs(qActives)}.` : undefined} />
                  </li>
                )
              })}
            </ul>
          </Block>
        )}

        <Block title="Reseñas" id="resenas" icon={<Chat size={22} />}>
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="tabular font-display text-[3rem] leading-none">{product.avgRating.toLocaleString('es-AR')}</p>
              <div>
                <Stars value={product.avgRating} size={16} />
                <p className="mt-1 text-sm text-ink-muted">{product.reviewCount} reseñas</p>
              </div>
              <p className="rounded-full border border-dashed border-line-strong px-3 py-1 text-[0.8125rem] font-medium text-ink-soft">Reseñas de ejemplo</p>
            </div>
            <ul className="mt-8 space-y-4">
              {reviews.map((r) => (
                <li key={r.author + r.title} className="rounded-[1.75rem] bg-shell p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <p className="text-[0.8125rem] text-ink-muted">
                      Piel {r.skinType.toLowerCase()} · lo usa hace {r.usingFor}
                    </p>
                  </div>
                  <p className="mt-3 font-medium">{r.title}</p>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{r.body}</p>
                  <p className="mt-3 text-[0.8125rem] text-ink-muted">{r.author}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
              Las reseñas, los puntajes y la cantidad de opiniones son contenido de ejemplo para la demo, no opiniones reales.
            </p>
          </div>
        </Block>

        <Block title="Ingredientes completos" icon={<Flask size={22} />}>
          <details className="group max-w-2xl rounded-[1.75rem] border border-line">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 text-[0.9375rem]">
              <span>
                Ver lista INCI <span className="text-ink-muted">({inci.length} ingredientes)</span>
              </span>
              <ChevronDown size={18} className="chevron shrink-0 text-ink-muted" />
            </summary>
            <div className="border-t border-line px-5 py-5">
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                {inci.map((pi, i) => (
                  <span key={pi.ingredientId}>
                    {i > 0 && ', '}
                    <span className={pi.isKeyActive ? 'font-medium text-ink' : undefined}>{pi.ingredient.inciName}</span>
                  </span>
                ))}
                .
              </p>
              <p className="mt-3 text-[0.8125rem] text-ink-muted">En orden de concentración. Los activos clave, resaltados.</p>
            </div>
          </details>
        </Block>
      </div>
    </article>
  )
}

function Block({ title, id, icon, children }: { title: string; id?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-5 border-t border-line py-10 md:grid-cols-[13rem_1fr] md:gap-12 md:py-14 lg:grid-cols-[16rem_1fr]">
      <h2 className="flex items-center gap-3 font-display text-display-sm md:flex-col md:items-start md:gap-4">
        {icon && <IconBadge size="lg">{icon}</IconBadge>}
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toLocaleString('es-AR')} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} filled={Math.max(0, Math.min(1, value - i))} />
      ))}
    </span>
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
