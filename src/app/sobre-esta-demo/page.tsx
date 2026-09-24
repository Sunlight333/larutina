import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowRight } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { editorialImage } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Sobre esta demo',
  description: 'Qué muestra la demo, qué es contenido de ejemplo y qué quedó afuera a propósito.',
}

const SHOWS = [
  {
    title: 'Un diagnóstico que arma la rutina con datos',
    body: 'Seis preguntas se traducen en tipo de piel y necesidades. La rutina sale de cruzar eso con los datos de cada producto: para qué piel es ideal, sobre qué trabaja, qué activos lleva y con cuáles no combina. Cada producto elegido trae el motivo.',
  },
  {
    title: 'Una ficha de producto que asesora',
    body: 'La estructura completa que propongo, con sus doce bloques: activos, evaluación propia, modo de uso, precauciones, rutinas en las que aparece y con qué combina.',
  },
  {
    title: 'El stack de la propuesta, medible',
    body: 'Next.js, PostgreSQL y Prisma, con las fichas generadas de forma estática. Los números de rendimiento del documento salen de esta demo.',
  },
]

export default function AboutPage() {
  const wide = editorialImage('still-life-wide')
  return (
    <>
      <section className="container-page pt-10 md:pt-16">
        <p className="eyebrow">Sobre esta demo</p>
        <h1 className="mt-4 max-w-3xl font-display text-display-lg text-balance">Una muestra acotada, para ver y medir en lugar de creer.</h1>
        <p className="mt-6 max-w-2xl text-lede text-ink-soft">
          Esta demo acompaña la respuesta al challenge técnico de LaRutina Beauty. No es la tienda: es una muestra acotada para que puedan ver y
          medir tres puntos del documento.
        </p>
      </section>

      <div className="container-page mt-10 md:mt-14">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-card)] bg-sand">
          <Image
            src={wide.src}
            alt="Cinco productos de las marcas de ejemplo sobre bloques de travertino"
            fill
            sizes="(min-width: 1216px) 1152px, 100vw"
            placeholder="blur"
            blurDataURL={wide.blur}
            className="object-cover"
          />
        </div>
      </div>

      <div className="container-page mt-4">
        <Row title="Qué muestra">
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {SHOWS.map((s, i) => (
              <li key={s.title}>
                <span className="tabular font-display text-[2rem] leading-none text-accent-ink">{i + 1}</span>
                <h3 className="mt-3 text-[1.0625rem] font-medium leading-snug">{s.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </Row>

        <Row title="Qué es de ejemplo">
          <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">
            Las marcas, los productos, los precios y las reseñas son inventados. Las fotos de producto se generaron con IA para esta demo, así no
            se usa material con derechos de terceros. Si LaRutina comparte su catálogo y sus fotos, se cargan en lugar de estos sin tocar el
            código.
          </p>
        </Row>

        <Row title="Qué dejé afuera a propósito">
          <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-ink-soft">
            Checkout, pagos, cuentas, panel de administración y embajadoras. Están resueltos en el documento y en los diagramas. Armarlos a medias
            no aportaba nada a la evaluación. Por eso los botones de compra muestran un aviso en lugar de agregar al carrito.
          </p>
        </Row>

        <Row title="Cómo medirla">
          <div className="max-w-2xl">
            <p className="text-[1.0625rem] leading-relaxed text-ink-soft">
              Abran cualquier ficha en el celular, o córranla en PageSpeed Insights. Los números del documento salen de ahí.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/diagnostico">
                Hacer el diagnóstico
                <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="/producto/serum-niacinamida-10-zinc" variant="secondary">
                Ver una ficha
              </ButtonLink>
            </div>
          </div>
        </Row>
      </div>
    </>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-b border-line py-10 md:grid-cols-[13rem_1fr] md:gap-12 md:py-14 lg:grid-cols-[16rem_1fr]">
      <h2 className="font-display text-display-sm">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
