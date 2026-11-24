import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowRight, FaceScan } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { LogoFull } from '@/components/site/logo'
import { ADMIN_HOST } from '@/lib/hosts'
import { faceCrop, lifestyleImage } from '@/lib/images'

// G-15, in the approved design: the text beside a round campaign portrait.
// On the panel host (src/proxy.ts), a short panel page instead.
export default async function NotFound() {
  const host = ((await headers()).get('host') ?? '').toLowerCase().replace(/:\d+$/, '')
  if (host === ADMIN_HOST) return <PanelNotFound />
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

function PanelNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-shell px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull className="w-64" />
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Esta página del panel no existe</h1>
          <p className="mt-2 text-sm text-ink-soft">Puede que el link esté mal escrito o que la página se haya movido.</p>
          <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper hover:opacity-90">
            Ir al inicio del panel
          </Link>
        </div>
      </div>
    </main>
  )
}
