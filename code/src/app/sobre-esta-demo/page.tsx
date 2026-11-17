import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowRight, Clock, Close, FaceScan, Flask, IconBadge, Layers, ShieldCheck } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { lifestyleImage } from '@/lib/images'
import { usingDatabase } from '@/server/db'

export const metadata: Metadata = {
  title: 'Sobre esta demo',
  description: 'Qué muestra la demo, qué es contenido de ejemplo y qué quedó afuera a propósito.',
}

// Describes the deploy truthfully: with or without a connected database.
const STACK = usingDatabase
  ? 'Next.js, PostgreSQL y Prisma, con las fichas generadas de forma estática. Los números de rendimiento del documento salen de esta demo.'
  : 'Next.js con las fichas generadas de forma estática, sobre el modelo de datos de la propuesta. Esta publicación lee el catálogo de ejemplo incluido en el código; con PostgreSQL conectado, lee y guarda en la base sin cambios. Los números de rendimiento del documento salen de esta demo.'

const SHOWS = [
  {
    icon: FaceScan,
    title: 'Un diagnóstico que arma la rutina con datos',
    body: 'Seis preguntas se traducen en tipo de piel y necesidades. La rutina sale de cruzar eso con los datos de cada producto: para qué piel es ideal, sobre qué trabaja, qué activos lleva y con cuáles no combina. Cada producto elegido trae el motivo.',
  },
  {
    icon: Flask,
    title: 'Una ficha de producto que asesora',
    body: 'La estructura completa que propongo, con sus doce bloques: activos, evaluación propia, modo de uso, precauciones, rutinas en las que aparece y con qué combina.',
  },
  { icon: Clock, title: 'El stack de la propuesta, medible', body: STACK },
]

const ROWS = [
  {
    icon: ShieldCheck,
    title: 'Qué es de ejemplo',
    body: 'Las marcas, los productos, los precios y las reseñas son inventados. Todas las imágenes se generaron con IA para esta demo, incluidas las modelos de las campañas: no son personas reales, y así no se usa material con derechos de terceros. Si LaRutina comparte su catálogo y sus fotos, se cargan en lugar de estos sin tocar el código.',
  },
  {
    icon: Close,
    title: 'Qué dejé afuera a propósito',
    body: 'Checkout, pagos, cuentas, panel de administración y embajadoras. Están resueltos en el documento y en los diagramas. Armarlos a medias no aportaba nada a la evaluación. Por eso los botones de compra muestran un aviso en lugar de agregar al carrito.',
  },
  {
    icon: Layers,
    title: 'Cómo medirla',
    body: 'Abran cualquier ficha en el celular, o córranla en PageSpeed Insights. Los números del documento salen de ahí.',
  },
]

export default function AboutPage() {
  const banner = lifestyleImage('bodegon')
  return (
    <>
      <section className="container-page pt-6 md:pt-10">
        <div className="shape-leaf relative flex min-h-[34rem] flex-col justify-end overflow-hidden bg-sand p-6 sm:p-10 lg:min-h-[36rem] lg:justify-center lg:p-16">
          <Image
            src={banner.src}
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1216px) 1152px, 100vw"
            placeholder="blur"
            blurDataURL={banner.blur}
            className="object-cover object-[84%_center] lg:object-[64%_center]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-paper via-paper/70 to-paper/0 lg:bg-linear-to-r lg:from-paper/95 lg:via-paper/60 lg:to-paper/0" />
          <div className="relative max-w-xl">
            <p className="eyebrow">Sobre esta demo</p>
            <h1 className="mt-4 font-display text-display-lg text-balance">Una muestra acotada, para ver y medir en lugar de creer.</h1>
            <p className="mt-5 text-lede text-ink-soft">
              Esta demo acompaña la respuesta al challenge técnico de LaRutina Beauty. No es la tienda: es una muestra acotada para que puedan ver y
              medir tres puntos del documento.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page mt-16 md:mt-24" aria-labelledby="muestra">
        <h2 id="muestra" className="font-display text-display-md">
          Qué muestra
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {SHOWS.map(({ icon: I, title, body }, i) => (
            <li key={title} className="relative rounded-t-[10rem] rounded-b-[2rem] bg-shell px-6 pt-10 pb-8 text-center">
              <span className="relative mx-auto block w-fit">
                <IconBadge size="xl" tone="ink">
                  <I size={30} />
                </IconBadge>
                <span className="tabular absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-accent text-[0.75rem] font-medium text-paper ring-2 ring-shell">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-6 font-display text-[1.35rem] leading-snug text-balance">{title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page mt-16 md:mt-24">
        <ul className="divide-y divide-line border-y border-line">
          {ROWS.map(({ icon: I, title, body }) => (
            <li key={title} className="grid gap-5 py-10 md:grid-cols-[16rem_1fr] md:gap-12">
              <h2 className="flex items-center gap-4 font-display text-display-sm md:flex-col md:items-start">
                <IconBadge size="lg">
                  <I size={24} />
                </IconBadge>
                {title}
              </h2>
              <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/diagnostico">
            Hacer el diagnóstico
            <ArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/producto/serum-niacinamida-10-zinc" variant="secondary">
            Ver una ficha
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
