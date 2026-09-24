import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Bulb,
  ConcernIcon,
  FaceScan,
  Flask,
  Hand,
  IconBadge,
  Layers,
  Moon,
  ShieldCheck,
  StepIcon,
  Sun,
} from '@/components/icons'
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel'
import { ProductCard } from '@/components/product-card'
import { ProductImage } from '@/components/product-image'
import { buttonClasses, ButtonLink } from '@/components/ui/button'
import { Curve } from '@/components/ui/curve'
import { CONCERNS } from '@/lib/catalog/coverage'
import { STEP, type StepType } from '@/lib/diagnosis/copy'
import { lifestyleImage, productImage } from '@/lib/images'
import { formatARS } from '@/lib/money'
import { getCatalog } from '@/server/services/catalog'

// Each hero campaign and the product it advertises.
const HERO_CAMPAIGNS = [
  { image: 'hero-1', position: 'object-[96%_center] lg:object-[18%_30%]', product: 'serum-acido-hialuronico', alt: 'Una modelo con la piel luminosa sostiene el sérum de ácido hialurónico de Nube Skin' },
  { image: 'hero-2', position: 'object-right lg:object-[72%_30%]', product: 'serum-vitamina-c-15', alt: 'Una modelo con luz dorada sostiene el sérum de vitamina C de Aurea Lab junto a su mejilla' },
  { image: 'hero-3', position: 'object-[84%_center] lg:object-[12%_30%]', product: 'crema-reparadora-barrera', alt: 'Una modelo sonriente sostiene la crema reparadora de barrera de Clara Botánica' },
]
const SHOWCASE = 'serum-niacinamida-10-zinc'
const FEATURED = ['serum-niacinamida-10-zinc', 'crema-reparadora-barrera', 'retinol-03-escualano', 'fluido-protector-fps-50']

const VALUES = [
  { icon: FaceScan, title: 'Diagnóstico en un minuto', body: 'Seis preguntas, sin registrarte.' },
  { icon: Layers, title: 'Mañana y noche', body: 'Cada paso, en el orden correcto.' },
  { icon: Bulb, title: 'El porqué de cada producto', body: 'Explicado con sus activos.' },
  { icon: ShieldCheck, title: 'Activos que conviven', body: 'Separamos los que no van juntos.' },
]

const HOW = [
  { icon: FaceScan, title: 'Contás cómo es tu piel', body: 'Brillo, granitos, sensibilidad y lo que querés mejorar. Seis preguntas, una por pantalla.' },
  { icon: Layers, title: 'Cruzamos cada producto', body: 'Para qué piel es ideal, sobre qué trabaja, qué activos lleva y con cuáles no combina.' },
  { icon: Bulb, title: 'Recibís tu rutina, con el porqué', body: 'Mañana y noche, paso por paso, con el motivo de cada elección y cómo usarla.' },
]

const MOMENTS = {
  AM: {
    image: 'manana',
    title: 'Tu rutina de mañana',
    body: 'Limpiar, preparar y proteger la piel para todo el día.',
    steps: ['CLEANSER', 'TONER', 'SERUM', 'MOISTURIZER', 'SUNSCREEN'] as StepType[],
  },
  PM: {
    image: 'noche',
    title: 'Tu rutina de noche',
    body: 'Tratar y reparar mientras dormís, sin mezclar activos que no van juntos.',
    steps: ['CLEANSER', 'EXFOLIANT', 'TREATMENT', 'MOISTURIZER'] as StepType[],
  },
}

const SHOWCASE_FEATURES = [
  { icon: Flask, title: 'Activos clave', body: 'Con su concentración y qué hace cada uno.' },
  { icon: Award, title: 'Nuestra evaluación', body: 'Un puntaje propio sobre 100, con sus motivos.' },
  { icon: Hand, title: 'Modo de uso', body: 'Cuándo, cuánto y en qué paso de la rutina.' },
  { icon: ShieldCheck, title: 'Compatibilidad', body: 'Con qué no combinarlo, calculado de los activos.' },
]

export default async function HomePage() {
  const { concerns, products } = await getCatalog()
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const ordered = CONCERNS.map((slug) => concerns.find((c) => c.slug === slug)).filter((c) => c !== undefined)
  const slides: HeroSlide[] = HERO_CAMPAIGNS.flatMap((c) => {
    const p = bySlug.get(c.product)
    const img = lifestyleImage(c.image)
    const thumb = productImage(c.product)
    if (!p || !thumb) return []
    return [
      {
        src: img.src,
        blur: img.blur,
        alt: c.alt,
        position: c.position,
        product: { href: `/producto/${p.slug}`, name: p.name, brand: p.brand.name, price: formatARS(p.priceCents), thumb: thumb.src, color: thumb.color ?? '' },
      },
    ]
  })
  const showcase = bySlug.get(SHOWCASE)
  const featured = FEATURED.map((s) => bySlug.get(s)).filter((p) => p !== undefined)
  const ficha = lifestyleImage('ficha')
  const night = lifestyleImage('noche')

  return (
    <>
      {/* Hero: three campaigns behind a fixed headline; the header floats over it. */}
      <section className="relative -mt-16 lg:-mt-[4.5rem]">
        <HeroCarousel slides={slides}>
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper/85 py-1.5 pr-3.5 pl-1.5 text-[0.8125rem] font-medium ring-1 ring-ink/5">
              <span className="grid size-6 place-items-center rounded-full bg-accent text-paper">
                <FaceScan size={14} />
              </span>
              Diagnóstico de piel · seis preguntas
            </p>
            <h1 className="mt-5 font-display text-display-hero text-balance">
              Tu rutina, pensada para <span className="italic">tu</span> piel.
            </h1>
            <p className="mt-5 max-w-md text-lede text-ink-soft">
              Respondé seis preguntas y armamos tu rutina de mañana y de noche, con productos elegidos uno por uno y el motivo de cada
              elección.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/diagnostico" size="lg" className="w-full sm:w-auto">
                Hacer mi diagnóstico
                <ArrowRight size={18} />
              </ButtonLink>
              <Link href="/productos" className={buttonClasses('secondary', 'lg', 'w-full border-ink/15 bg-paper/75 sm:w-auto')}>
                Ver productos
              </Link>
            </div>
          </div>
        </HeroCarousel>
        <Curve className="absolute inset-x-0 -bottom-px text-paper" />
      </section>

      {/* What the store does, with the icons up front. */}
      <section className="container-page relative z-10 -mt-12 lg:-mt-20" aria-label="Qué hace LaRutina">
        <ul className="grid grid-cols-2 gap-2 rounded-[2rem] bg-paper p-2 shadow-[0_30px_60px_-40px_rgb(40_30_20/0.45)] ring-1 ring-line/70 lg:grid-cols-4 lg:gap-0 lg:p-3">
          {VALUES.map(({ icon: I, title, body }, i) => (
            <li
              key={title}
              className={`flex flex-col gap-3 rounded-[1.5rem] p-4 lg:flex-row lg:items-center lg:gap-4 lg:rounded-none lg:p-5 ${i > 0 ? 'lg:border-l lg:border-line' : ''}`}
            >
              <IconBadge size="lg">
                <I size={24} />
              </IconBadge>
              <div>
                <p className="text-[0.9375rem] leading-snug font-medium">{title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Concerns: arches, staggered. */}
      <section className="mt-24 md:mt-32" aria-labelledby="necesidades">
        <div className="container-page flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="eyebrow">Comprar por necesidad</p>
            <h2 id="necesidades" className="mt-3 font-display text-display-lg text-balance">
              ¿Qué te gustaría mejorar?
            </h2>
          </div>
          <Link href="/productos" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
            Ver todos los productos <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="scroller mt-10 flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:mx-auto lg:grid lg:max-w-[76rem] lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-8 lg:pb-16">
          {ordered.map((c, i) => {
            const img = lifestyleImage(c.slug)
            return (
              <li key={c.slug} className={`w-[72vw] max-w-[19rem] shrink-0 sm:w-[42vw] lg:w-auto lg:max-w-none ${i % 3 === 1 ? 'lg:translate-y-16' : ''}`}>
                <Link href={`/productos?necesidad=${c.slug}`} className="group block">
                  <div className="shape-arch relative aspect-[3/4] overflow-hidden bg-sand">
                    <Image
                      src={img.src}
                      alt=""
                      fill
                      sizes="(min-width: 1216px) 360px, (min-width: 1024px) 30vw, (min-width: 640px) 42vw, 72vw"
                      placeholder="blur"
                      blurDataURL={img.blur}
                      className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                    />
                  </div>
                  <div className="relative -mt-8 flex items-end justify-between px-4">
                    <IconBadge size="xl" tone="paper" className="ring-[5px] ring-paper">
                      <ConcernIcon slug={c.slug} size={28} />
                    </IconBadge>
                    <span className="grid size-11 place-items-center rounded-full border border-line-strong bg-paper transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <h3 className="mt-4 px-1 font-display text-[1.5rem] leading-tight">{c.name}</h3>
                  <p className="mt-1.5 px-1 text-[0.9375rem] leading-snug text-ink-muted">{c.description}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* How it works: a curved band with an icon timeline. */}
      <section className="relative mt-20 md:mt-24" aria-labelledby="como">
        <Curve className="text-shell" />
        <div className="bg-shell">
          <div className="container-page grid gap-12 py-14 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20">
            <div>
              <p className="eyebrow">Cómo funciona</p>
              <h2 id="como" className="mt-3 font-display text-display-lg text-balance">
                Un minuto, y una rutina que se explica sola.
              </h2>
              <p className="mt-5 max-w-md text-lede text-ink-soft">
                Detrás de cada recomendación hay datos de producto, no intuición: tipo de piel, necesidades, activos y compatibilidad.
              </p>
              <ButtonLink href="/diagnostico" className="mt-8">
                Empezar ahora <ArrowRight size={18} />
              </ButtonLink>
            </div>
            <ol className="relative grid gap-4">
              <span aria-hidden="true" className="absolute top-12 bottom-12 left-[2.95rem] border-l border-dashed border-line-strong sm:left-[3.2rem]" />
              {HOW.map(({ icon: I, title, body }, i) => (
                <li key={title} className="relative flex items-center gap-5 rounded-[2.25rem] bg-paper p-4 pr-6 shadow-[0_20px_40px_-32px_rgb(40_30_20/0.5)] sm:gap-6 sm:p-5">
                  <span className="relative">
                    <IconBadge size="xl" tone="ink">
                      <I size={28} />
                    </IconBadge>
                    <span className="tabular absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-accent text-[0.75rem] font-medium text-paper ring-2 ring-paper">
                      {i + 1}
                    </span>
                  </span>
                  <div>
                    <h3 className="text-[1.0625rem] font-medium">{title}</h3>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Curve className="text-shell" flip />
      </section>

      {/* Morning and night: two moods, two leaf-cornered panels. */}
      <section className="container-page mt-20 md:mt-28" aria-labelledby="momentos">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Dos momentos, dos rutinas</p>
          <h2 id="momentos" className="mt-3 font-display text-display-lg text-balance">
            Tu piel no necesita lo mismo a la mañana que a la noche.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {(['AM', 'PM'] as const).map((m) => {
            const moment = MOMENTS[m]
            const img = lifestyleImage(moment.image)
            return (
              <article
                key={m}
                className={`relative flex min-h-[34rem] flex-col justify-end overflow-hidden p-6 text-paper sm:min-h-[38rem] sm:p-10 ${
                  m === 'AM' ? 'shape-leaf' : 'shape-leaf-alt lg:mt-20'
                }`}
              >
                <Image src={img.src} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
                <div className={`absolute inset-0 bg-linear-to-t to-transparent ${m === 'AM' ? 'from-ink/85 via-ink/35' : 'from-night-deep/95 via-night-deep/45'}`} />
                <div className="relative">
                  <IconBadge size="lg" tone="night">
                    {m === 'AM' ? <Sun size={26} /> : <Moon size={24} />}
                  </IconBadge>
                  <h3 className="mt-5 font-display text-display-md">{moment.title}</h3>
                  <p className="mt-2 max-w-sm text-paper/80">{moment.body}</p>
                  <ol className="mt-6 flex flex-wrap gap-2">
                    {moment.steps.map((s, i) => (
                      <li key={s} className="inline-flex items-center gap-2 rounded-full bg-ink/35 py-1.5 pr-3.5 pl-1.5 text-sm ring-1 ring-paper/20">
                        <span className="tabular grid size-6 place-items-center rounded-full bg-paper text-[0.75rem] font-medium text-ink">{i + 1}</span>
                        <StepIcon type={s} size={16} />
                        {STEP[s].name}
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* The product page, shown in use. */}
      {showcase && (
        <section className="container-page mt-24 grid items-center gap-16 md:mt-36 lg:grid-cols-2 lg:gap-20" aria-labelledby="ficha">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="shape-blob relative aspect-[4/5] overflow-hidden bg-sand">
              <Image
                src={ficha.src}
                alt="Una modelo con la piel luminosa sostiene el sérum de niacinamida de Aurea Lab"
                fill
                sizes="(min-width: 1024px) 560px, 90vw"
                placeholder="blur"
                blurDataURL={ficha.blur}
                className="object-cover"
              />
            </div>
            <Link
              href={`/producto/${showcase.slug}`}
              aria-label={`Ver ${showcase.name}`}
              className="shape-arch absolute -right-2 -bottom-10 w-32 overflow-hidden shadow-[0_30px_50px_-24px_rgb(40_30_20/0.55)] ring-[6px] ring-paper transition-transform hover:-translate-y-1 sm:-right-6 sm:w-44"
            >
              <ProductImage slug={showcase.slug} name={showcase.name} sizes="176px" rounded="rounded-none" />
            </Link>
            <div className="absolute top-6 -left-2 flex items-center gap-3 rounded-full bg-paper py-2 pr-5 pl-2 shadow-[0_24px_40px_-24px_rgb(40_30_20/0.55)] sm:-left-6">
              <ScoreDial score={showcase.ourRating} />
              <span>
                <span className="block text-[0.75rem] text-ink-muted">Nuestra evaluación</span>
                <span className="block font-display text-[1.15rem] leading-tight">{showcase.ourRating} de 100</span>
              </span>
            </div>
          </div>
          <div>
            <p className="eyebrow">Así se ve una ficha</p>
            <h2 id="ficha" className="mt-3 font-display text-display-lg text-balance">
              Cada producto, explicado como lo haría una asesora.
            </h2>
            <p className="mt-5 max-w-lg text-lede text-ink-soft">Todo lo que hace falta para elegir con criterio, en el orden en que lo preguntarías.</p>
            <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {SHOWCASE_FEATURES.map(({ icon: I, title, body }) => (
                <li key={title} className="flex gap-4">
                  <IconBadge>
                    <I size={22} />
                  </IconBadge>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-0.5 text-sm leading-snug text-ink-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href={`/producto/${showcase.slug}`}>
                Ver la ficha completa <ArrowRight size={18} />
              </ButtonLink>
              <p className="text-sm text-ink-muted">
                {showcase.name} · <span className="tabular">{formatARS(showcase.priceCents)}</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Featured products. */}
      <section className="mt-28 md:mt-36" aria-labelledby="destacados">
        <div className="container-page flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Selección</p>
            <h2 id="destacados" className="mt-3 font-display text-display-lg">
              Los más elegidos
            </h2>
          </div>
          <Link href="/productos" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
            Ver los 18 productos <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="scroller mt-10 flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:mx-auto lg:grid lg:max-w-[76rem] lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-8">
          {featured.map((p) => (
            <li key={p.id} className="w-[62vw] max-w-[17rem] shrink-0 sm:w-[40vw] lg:w-auto lg:max-w-none">
              <ProductCard product={p} sizes="(min-width: 1216px) 270px, (min-width: 1024px) 23vw, (min-width: 640px) 40vw, 62vw" />
            </li>
          ))}
        </ul>
      </section>

      {/* Closing call to action, flowing into the footer. */}
      <section className="relative mt-28 -mb-24 md:mt-36" aria-labelledby="cierre">
        <Curve className="text-night-deep" />
        <div className="relative overflow-hidden bg-night-deep text-paper">
          <Image src={night.src} alt="" fill sizes="100vw" placeholder="blur" blurDataURL={night.blur} className="object-cover object-[center_40%] opacity-60" />
          <div className="absolute inset-0 bg-linear-to-r from-night-deep via-night-deep/80 to-night-deep/10" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-night-deep to-transparent" />
          <div className="container-page relative py-20 md:py-32">
            <div className="max-w-xl">
              <IconBadge size="lg" tone="night">
                <Moon size={24} />
              </IconBadge>
              <h2 id="cierre" className="mt-6 font-display text-display-lg text-balance">
                Tu piel cambia de la mañana a la noche. Tu rutina, también.
              </h2>
              <p className="mt-5 max-w-md text-lede text-paper/75">Seis preguntas y la tenés armada, con el porqué de cada paso.</p>
              <ButtonLink href="/diagnostico" variant="inverse" size="lg" className="mt-9">
                Hacer mi diagnóstico <ArrowRight size={18} />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function ScoreDial({ score }: { score: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" className="-rotate-90" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
    </svg>
  )
}
