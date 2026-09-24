import Image from 'next/image'
import { ArrowRight, FaceScan } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { lifestyleImage } from '@/lib/images'

export default function NotFound() {
  const img = lifestyleImage('diagnostico')
  return (
    <section className="container-page grid items-center gap-12 py-16 md:grid-cols-[1fr_22rem] md:py-24 lg:grid-cols-[1fr_26rem]">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-4 font-display text-display-lg text-balance">Esta página no está en la rutina.</h1>
        <p className="mt-5 max-w-lg text-lede text-ink-soft">
          Puede que el link esté incompleto o que el resultado ya no exista. Desde acá podés volver a empezar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/diagnostico">
            <FaceScan size={18} />
            Hacer el diagnóstico
          </ButtonLink>
          <ButtonLink href="/productos" variant="secondary">
            Ver productos <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </div>
      <div className="relative mx-auto aspect-square w-64 overflow-hidden rounded-full ring-[10px] ring-shell md:w-full">
        <Image src={img.src} alt="" fill sizes="(min-width: 768px) 416px, 256px" placeholder="blur" blurDataURL={img.blur} className="object-cover object-[50%_25%]" />
      </div>
    </section>
  )
}
