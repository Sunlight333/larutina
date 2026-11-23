import Image from 'next/image'
import { ArrowRight, FaceScan } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { faceCrop, lifestyleImage } from '@/lib/images'

// G-15, in the approved design: the text beside a round campaign portrait.
export default function NotFound() {
  const img = lifestyleImage('diagnostico')
  return (
    <main id="contenido" className="container-page grid flex-1 items-center gap-12 py-16 md:grid-cols-[1fr_22rem] md:py-24 lg:grid-cols-[1fr_26rem]">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-4 max-w-2xl font-display text-display-lg text-balance">Esta página no existe, o ya no está.</h1>
        <p className="mt-5 max-w-lg text-lede text-ink-soft">Volvé al inicio o hacé tu diagnóstico.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">
            Ir al inicio <ArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/diagnostico" variant="secondary">
            <FaceScan size={18} />
            Hacer mi diagnóstico
          </ButtonLink>
        </div>
      </div>
      <div className="relative mx-auto aspect-square w-64 overflow-hidden rounded-full ring-[10px] ring-shell md:w-full">
        <Image src={img.src} alt="" fill sizes="(min-width: 768px) 600px, 360px" placeholder="blur" blurDataURL={img.blur} className="object-cover" style={faceCrop(img, 1.35)} />
      </div>
    </main>
  )
}
