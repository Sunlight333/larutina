import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Moon, Sun } from '@/components/icons'
import { ProductImage } from '@/components/product-image'
import { ButtonLink } from '@/components/ui/button'
import { CONCERNS } from '@/lib/catalog/coverage'
import { SKIN_TYPE, joinEs } from '@/lib/diagnosis/copy'
import { concernImage, editorialImage } from '@/lib/images'
import { formatARS } from '@/lib/money'
import { getCatalog } from '@/server/services/catalog'

const SHOWCASE = 'serum-niacinamida-10-zinc'

export default async function HomePage() {
  const { concerns, products } = await getCatalog()
  const ordered = CONCERNS.map((slug) => concerns.find((c) => c.slug === slug)).filter((c) => c !== undefined)
  const showcase = products.find((p) => p.slug === SHOWCASE)
  const hero = editorialImage('hero')

  return (
    <>
      <section className="container-page grid items-center gap-10 pt-8 pb-16 md:pt-12 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pt-16 lg:pb-24">
        <div className="animate-rise">
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Diagnóstico de piel · seis preguntas
          </p>
          <h1 className="mt-5 font-display text-display-lg text-balance">
            Una rutina pensada para <span className="italic">tu</span> piel, no para la de todas.
          </h1>
          <p className="mt-6 max-w-xl text-lede text-ink-soft">
            Respondé seis preguntas y armamos tu rutina de mañana y de noche con productos elegidos uno por uno, y el motivo de cada elección.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <ButtonLink href="/diagnostico" size="lg" className="w-full sm:w-auto">
              Hacer mi diagnóstico
              <ArrowRight size={18} />
            </ButtonLink>
            <p className="text-center text-sm text-ink-muted sm:text-left">Menos de un minuto. Sin registrarte.</p>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand">
            <Image
              src={hero.src}
              alt="Productos de las cinco marcas de ejemplo sobre bloques de travertino, con luz de mañana"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 1216px) 560px, (min-width: 1024px) 46vw, 100vw"
              placeholder="blur"
              blurDataURL={hero.blur}
              className="object-cover"
            />
          </div>
          {/* Sits on the empty wall at the top of the photo, clear of the products. */}
          <div
            className="absolute top-3 left-3 w-48 rounded-2xl bg-paper/90 p-3.5 shadow-[0_20px_50px_-20px_rgb(40_30_20/0.45)] backdrop-blur-md sm:top-6 sm:left-6 sm:w-64 sm:p-4 lg:top-10 lg:-left-10"
            aria-hidden="true"
          >
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <Sun size={16} className="text-accent-ink" />
              Tu rutina de mañana
            </p>
            <ol className="mt-2.5 space-y-1.5 text-[0.8125rem] sm:mt-3 sm:space-y-2 sm:text-sm">
              {['Limpieza', 'Sérum', 'Protección solar'].map((s, i) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="tabular grid size-5 place-items-center rounded-full bg-ink text-[0.6875rem] text-paper">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-3 hidden items-center gap-2 border-t border-line pt-3 text-[0.8125rem] text-ink-muted sm:flex">
              <Moon size={14} />
              Y otra para la noche
            </p>
          </div>
        </div>
      </section>

      <section className="container-page" aria-labelledby="necesidades">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Empezá por lo que te preocupa</p>
            <h2 id="necesidades" className="mt-3 font-display text-display-md">
              ¿Qué te gustaría mejorar?
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">Todas llevan al diagnóstico. Si lo que elegís es una de las opciones, ya la dejamos marcada.</p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:gap-x-6 lg:gap-y-10">
          {ordered.map((c) => {
            const img = concernImage(c.slug)
            return (
              <li key={c.slug}>
                <Link href={`/diagnostico?foco=${c.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-[var(--radius-image)] bg-shell">
                    {img && (
                      <Image
                        src={img.src}
                        alt=""
                        fill
                        sizes="(min-width: 1216px) 370px, (min-width: 768px) 31vw, 46vw"
                        placeholder="blur"
                        blurDataURL={img.blur}
                        className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                  <h3 className="mt-3.5 flex items-center justify-between gap-2 font-display text-[1.2rem] leading-tight sm:text-[1.35rem]">
                    {c.name}
                    <ArrowRight size={18} className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </h3>
                  <p className="mt-1.5 text-sm leading-snug text-ink-muted">{c.description}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="container-page mt-20 md:mt-28" aria-labelledby="como">
        <div className="rounded-[var(--radius-card)] bg-shell px-6 py-12 sm:px-10 md:px-14 md:py-16">
          <h2 id="como" className="max-w-xl font-display text-display-md text-balance">
            Cómo se arma tu rutina
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ['Contás cómo es tu piel', 'Seis preguntas sobre el brillo, los granitos, la sensibilidad y lo que querés mejorar.'],
              ['Cruzamos cada producto', 'Cada uno tiene datos: para qué piel es ideal, sobre qué trabaja, qué activos lleva y con cuáles no combina.'],
              ['Recibís tu rutina, con el porqué', 'Mañana y noche, paso por paso, con el motivo de cada elección y cómo usarla.'],
            ].map(([title, body], i) => (
              <li key={title} className="border-t border-line-strong/70 pt-6">
                <span className="tabular font-display text-[2.25rem] leading-none text-accent-ink">{i + 1}</span>
                <h3 className="mt-4 text-[1.0625rem] font-medium">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {showcase && (
        <section className="container-page mt-20 grid items-center gap-10 md:mt-28 md:grid-cols-2 md:gap-14 lg:gap-20" aria-labelledby="ficha">
          <Link href={`/producto/${showcase.slug}`} className="group block" tabIndex={-1} aria-hidden="true">
            <ProductImage
              slug={showcase.slug}
              name={showcase.name}
              sizes="(min-width: 1216px) 540px, (min-width: 768px) 45vw, 100vw"
              className="transition-opacity group-hover:opacity-95"
            />
          </Link>
          <div>
            <p className="eyebrow">Así se ve una ficha</p>
            <h2 id="ficha" className="mt-3 font-display text-display-md text-balance">
              Cada producto, explicado como lo haría una asesora.
            </h2>
            <p className="mt-5 max-w-lg text-lede text-ink-soft">
              Los activos, para qué piel sirve, nuestra evaluación, cómo usarlo, con qué no combinarlo y en qué rutinas aparece.
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-5">
              <div>
                <dt className="text-[0.8125rem] text-ink-muted">Evaluación</dt>
                <dd className="tabular mt-1 font-display text-[1.75rem] leading-none">
                  {showcase.ourRating}
                  <span className="text-base text-ink-muted">/100</span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.8125rem] text-ink-muted">Ideal para</dt>
                <dd className="mt-1 text-[0.9375rem] leading-snug">
                  Piel{' '}
                  {joinEs(
                    showcase.skinTypes.filter((s) => s.suitability === 'IDEAL').map((s) => SKIN_TYPE[s.skinType.slug]?.name.toLowerCase() ?? s.skinType.slug),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[0.8125rem] text-ink-muted">Precio</dt>
                <dd className="tabular mt-1 text-[0.9375rem]">{formatARS(showcase.priceCents)}</dd>
              </div>
            </dl>
            <ButtonLink href={`/producto/${showcase.slug}`} variant="secondary" className="mt-8">
              Ver la ficha completa
              <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </section>
      )}
    </>
  )
}
