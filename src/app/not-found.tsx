import Image from 'next/image'
import { ArrowRight } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { concernImage } from '@/lib/images'

export default function NotFound() {
  const img = concernImage('deshidratacion')
  return (
    <section className="container-page grid items-center gap-10 py-16 md:grid-cols-[1fr_22rem] md:py-24">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-4 font-display text-display-lg text-balance">Esta página no está en la rutina.</h1>
        <p className="mt-5 max-w-lg text-lede text-ink-soft">
          Puede que el link esté incompleto o que el resultado ya no exista. Desde acá podés volver a empezar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/diagnostico">
            Hacer el diagnóstico
            <ArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Ir al inicio
          </ButtonLink>
        </div>
      </div>
      {img && (
        <Image
          src={img.src}
          alt=""
          width={352}
          height={352}
          placeholder="blur"
          blurDataURL={img.blur}
          className="hidden aspect-square w-full rounded-[var(--radius-card)] object-cover md:block"
        />
      )}
    </section>
  )
}
