import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Bulb,
  Check,
  ConcernIcon,
  FaceScan,
  Flask,
  Hand,
  IconBadge,
  Layers,
  Moon,
  ShieldCheck,
  Sparkle,
  StepIcon,
  Sun,
} from '@/components/icons'
import { HeroCarousel, type HeroProduct, type HeroSlide } from '@/components/home/hero-carousel'
import { ProductCard } from '@/components/product-card'
import { ProductImage } from '@/components/product-image'
import { buttonClasses, ButtonLink } from '@/components/ui/button'
import { Curve } from '@/components/ui/curve'
import { CONCERNS } from '@/lib/catalog/coverage'
import { STEP, type StepType } from '@/lib/diagnosis/copy'
import { lifestyleImage, productImage, type LifestyleName } from '@/lib/images'
import { formatARS } from '@/lib/money'
import { getCatalog } from '@/server/services/catalog'

// The hero campaigns: the same three models, three moments in the same
// apartment. Each product's spot is where its hotspot goes in the photo, and
// card the side its preview opens on, clear of the product and the faces.
const HERO_CAMPAIGNS: {
  image: LifestyleName
  title: string
  alt: string
  focus: HeroSlide['focus']
  products: [slug: string, spot: [number, number], card: HeroProduct['card']][]
}[] = [
  {
    image: 'hero-1',
    title: 'Luminosidad',
    alt: 'Tres amigas con la piel luminosa junto a una ventana soleada: una sostiene el sérum de vitamina C de Aurea Lab, otra el fluido protector FPS 50 de Mar de Sal y otra la crema reparadora de barrera de Clara Botánica.',
    focus: { tablet: [0.94, 0.5], desktop: [0.62, 0.3] },
    products: [
      ['serum-vitamina-c-15', [0.548, 0.45], 'below'],
      ['fluido-protector-fps-50', [0.617, 0.735], 'above'],
      ['crema-reparadora-barrera', [0.895, 0.45], 'below'],
    ],
  },
  {
    image: 'hero-2',
    title: 'Hidratación',
    alt: 'Las mismas tres amigas se ríen en un sillón con el sérum de ácido hialurónico, el gel crema ligero y el tónico hidratante de Nube Skin.',
    focus: { tablet: [1, 0.5], desktop: [0.62, 0.3] },
    products: [
      ['serum-acido-hialuronico', [0.588, 0.58], 'below'],
      ['gel-crema-ligero', [0.8, 0.585], 'below'],
      ['tonico-hidratante', [0.84, 0.5], 'left'],
    ],
  },
  {
    image: 'hero-3',
    title: 'Reparación',
    alt: 'Las tres amigas bajo un arco con la luz de la tarde, con el tónico calmante de centella, la crema con péptidos y el retinol de Verde Raíz.',
    focus: { tablet: [0.94, 0.5], desktop: [0.62, 0.3] },
    products: [
      ['tonico-calmante-centella', [0.567, 0.53], 'below'],
      ['crema-con-peptidos', [0.745, 0.765], 'above'],
      ['retinol-03-escualano', [0.77, 0.475], 'above'],
    ],
  },
]

// The products on the still-life table, left to right.
const TABLE = ['serum-vitamina-c-15', 'crema-reparadora-barrera', 'fluido-protector-fps-50', 'serum-acido-hialuronico', 'tonico-calmante-centella']
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
} as const

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
  const slides: HeroSlide[] = HERO_CAMPAIGNS.map((c) => {
    const img = lifestyleImage(c.image)
    const phone = lifestyleImage(`${c.image}-phone`)
    return {
      src: img.src,
      width: img.width,
      height: img.height,
      phone: { src: phone.src, width: phone.width, height: phone.height, crop: phone.crop ?? { left: 0, width: 1 } },
      alt: c.alt,
      title: c.title,
      focus: c.focus,
      products: c.products.flatMap(([slug, spot, card]) => {
        const p = bySlug.get(slug)
        const thumb = productImage(slug)
        if (!p || !thumb) return []
        return [{ href: `/producto/${p.slug}`, name: p.name, brand: p.brand.name, price: formatARS(p.priceCents), thumb: thumb.src, color: thumb.color ?? '', spot, card }]
      }),
    }
  })
  const table = TABLE.map((s) => bySlug.get(s)).filter((p) => p !== undefined)
  const showcase = bySlug.get(SHOWCASE)
  const featured = FEATURED.map((s) => bySlug.get(s)).filter((p) => p !== undefined)
  const bodegon = lifestyleImage('bodegon')
  const diagnostico = lifestyleImage('diagnostico')
  const ficha = lifestyleImage('ficha')
  const night = lifestyleImage('noche')
  const retinol = bySlug.get('retinol-03-escualano')
  const retinolThumb = productImage('retinol-03-escualano')

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
        <Curve className="absolute inset-x-0 -bottom-px z-[4] text-paper" />
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

      {/* Concerns: arches, staggered, one of the cast in each. */}
      <section className="defer-render mt-24 md:mt-32" aria-labelledby="necesidades">
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

      {/* The campaign's still life: a pause, and what the store stands for. */}
      <section className="defer-render relative mt-16 md:mt-24" aria-labelledby="criterio">
        <div className="relative isolate overflow-hidden bg-sand">
          <Curve outside className="absolute inset-x-0 top-0 z-10 text-paper" />
          <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[44rem]">
            <Image
              src={bodegon.src}
              alt="Los productos de la campaña sobre una mesa de travertino junto a la ventana, con flores y luz de mañana."
              fill
              sizes="100vw"
              placeholder="blur"
              blurDataURL={bodegon.blur}
              className="object-cover object-[86%_center] sm:object-[80%_center] lg:object-[62%_center]"
            />
            <div className="absolute inset-0 hidden bg-linear-to-r from-paper/75 via-paper/35 via-40% to-paper/0 to-60% lg:block" />
          </div>
          <div className="relative bg-paper lg:absolute lg:inset-0 lg:flex lg:items-center lg:bg-transparent">
            <div className="container-page py-12 lg:py-0">
              <div className="max-w-lg">
                <p className="eyebrow">Nuestro criterio</p>
                <h2 id="criterio" className="mt-3 font-display text-display-lg text-balance">
                  Menos pasos, <span className="italic">mejor</span> elegidos.
                </h2>
                <p className="mt-5 text-lede text-ink-soft">
                  Cada producto está elegido por lo que lleva y para quién es. Te decimos para qué sirve, cómo usarlo y con qué no combinarlo.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
                  <ul className="flex -space-x-2.5" aria-label="En la mesa">
                    {table.map((p) => {
                      const thumb = productImage(p.slug)
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/producto/${p.slug}`}
                            aria-label={`${p.brand.name}, ${p.name}`}
                            title={p.name}
                            className="relative block size-12 overflow-hidden rounded-full ring-[3px] ring-paper transition-transform hover:z-10 hover:-translate-y-1"
                            style={{ backgroundColor: thumb?.color }}
                          >
                            {thumb && <Image src={thumb.src} alt="" fill sizes="48px" className="scale-[1.55] object-cover object-[50%_42%]" />}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                  <Link href="/productos" className="inline-flex items-center gap-2 text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
                    Ver la selección <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <Curve outside flip className="absolute inset-x-0 bottom-0 z-10 hidden text-paper lg:block" />
        </div>
      </section>

      {/* How it works: the diagnosis on a portrait, with an icon timeline. */}
      <section className="defer-render relative mt-16 md:mt-20" aria-labelledby="como">
        <Curve className="text-shell" />
        <div className="bg-shell">
          <div className="container-page grid gap-16 py-14 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-24">
            <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none">
              <div className="shape-arch relative aspect-[4/5] overflow-hidden bg-sand">
                <Image
                  src={diagnostico.src}
                  alt="Una de las modelos se toca la mejilla mientras sostiene el gel crema ligero de Nube Skin."
                  fill
                  sizes="(min-width: 1024px) 480px, 90vw"
                  placeholder="blur"
                  blurDataURL={diagnostico.blur}
                  className="object-cover"
                />
              </div>
              {/* A question of the diagnosis, as it looks on the phone. */}
              <div aria-hidden="true" className="absolute -right-2 bottom-[27%] w-[13.5rem] rounded-[1.75rem] bg-paper p-4 shadow-[0_30px_60px_-30px_rgb(40_30_20/0.55)] ring-1 ring-line/60 sm:top-[14%] sm:-right-10 sm:bottom-auto sm:w-[15.5rem]">
                <div className="flex items-center justify-between text-[0.6875rem] font-medium tracking-[0.06em] text-ink-muted uppercase">
                  <span>Pregunta 3 de 6</span>
                  <span className="tabular">50%</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-line">
                  <div className="h-full w-1/2 rounded-full bg-accent" />
                </div>
                <p className="mt-3.5 font-display text-[1.2rem] leading-tight">¿Qué te gustaría mejorar?</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[0.75rem]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink py-1.5 pr-3 pl-2 text-paper">
                    <Check size={13} /> Manchas
                  </span>
                  <span className="rounded-full px-3 py-1.5 ring-1 ring-line-strong">Poros y brillo</span>
                  <span className="rounded-full px-3 py-1.5 ring-1 ring-line-strong">Rojeces</span>
                </div>
              </div>
              <div aria-hidden="true" className="absolute bottom-[4%] -left-2 flex sm:bottom-[9%] sm:-left-10 items-center gap-3 rounded-full bg-paper py-2.5 pr-5 pl-2.5 shadow-[0_30px_60px_-30px_rgb(40_30_20/0.55)] ring-1 ring-line/60">
                <IconBadge size="md">
                  <Sparkle size={22} />
                </IconBadge>
                <span>
                  <span className="block text-[0.75rem] text-ink-muted">Tu rutina está lista</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[0.9375rem] font-medium">
                    <Sun size={15} /> 5 pasos <span className="text-line-strong">·</span> <Moon size={14} /> 4 pasos
                  </span>
                </span>
              </div>
            </div>
            <div>
              <p className="eyebrow">Cómo funciona</p>
              <h2 id="como" className="mt-3 font-display text-display-lg text-balance">
                Un minuto, y una rutina que se explica sola.
              </h2>
              <p className="mt-5 max-w-md text-lede text-ink-soft">
                Detrás de cada recomendación hay datos de producto, no intuición: tipo de piel, necesidades, activos y compatibilidad.
              </p>
              <ol className="relative mt-9 grid gap-3">
                <span aria-hidden="true" className="absolute top-10 bottom-10 left-[2.2rem] border-l border-dashed border-line-strong" />
                {HOW.map(({ icon: I, title, body }, i) => (
                  <li key={title} className="relative flex items-center gap-5 rounded-[2.25rem] bg-paper p-3 pr-6 shadow-[0_20px_40px_-32px_rgb(40_30_20/0.5)]">
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
              <ButtonLink href="/diagnostico" className="mt-9">
                Empezar ahora <ArrowRight size={18} />
              </ButtonLink>
            </div>
          </div>
        </div>
        <Curve className="text-shell" flip />
      </section>

      {/* Morning and night: two moods, two leaf-cornered panels. */}
      <section className="defer-render container-page mt-20 md:mt-28" aria-labelledby="momentos">
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
                <Image src={img.src} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" placeholder="blur" blurDataURL={img.blur} className="object-cover object-top" />
                <div className={`absolute inset-0 bg-linear-to-t to-transparent ${m === 'AM' ? 'from-ink/85 via-ink/30 via-45%' : 'from-night-deep/95 via-night-deep/40 via-45%'}`} />
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
                alt="Una de las modelos sostiene el sérum de niacinamida de Aurea Lab, con una gota en la yema del dedo."
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
      <section className="defer-render mt-28 md:mt-36" aria-labelledby="destacados">
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

      {/* Closing call to action: the night campaign, flowing into the footer. */}
      <section className="relative mt-28 -mb-24 md:mt-36" aria-labelledby="cierre">
        <Curve className="text-night-deep" />
        <div className="relative overflow-hidden bg-night-deep text-paper">
          <div aria-hidden="true" className="absolute top-1/2 right-[8%] size-[42rem] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(214_150_96/0.28),transparent)]" />
          <div className="container-page relative grid items-center gap-14 pt-12 pb-28 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:pb-32">
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
            <div className="relative mx-auto w-full max-w-[22rem] lg:mr-0 lg:max-w-[26rem]">
              <div className="shape-arch relative aspect-[4/5] overflow-hidden ring-1 ring-white/10">
                <Image
                  src={night.src}
                  alt="Una de las modelos, de noche, deja caer una gota del retinol de Verde Raíz sobre la yema de los dedos."
                  fill
                  sizes="(min-width: 1024px) 416px, 352px"
                  placeholder="blur"
                  blurDataURL={night.blur}
                  className="object-cover"
                />
              </div>
              {retinol && retinolThumb && (
                <Link
                  href={`/producto/${retinol.slug}`}
                  className="group absolute -bottom-6 -left-4 flex items-center gap-3 rounded-full bg-paper py-1.5 pr-5 pl-1.5 text-ink shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] transition-transform hover:-translate-y-0.5 sm:-left-10"
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-full" style={{ backgroundColor: retinolThumb.color }}>
                    <Image src={retinolThumb.src} alt="" fill sizes="44px" className="scale-[1.55] object-cover object-[50%_42%]" />
                  </span>
                  <span>
                    <span className="block text-[0.75rem] text-ink-muted">En la foto · {retinol.brand.name}</span>
                    <span className="block text-[0.9375rem] font-medium">{retinol.name}</span>
                  </span>
                  <ArrowUpRight size={16} className="text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              )}
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
