import type { Metadata } from 'next'
import Image from 'next/image'
import { ArrowRight, Bulb, FaceScan, IconBadge, Layers } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { lifestyleImage } from '@/lib/images'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = {
  title: 'Diagnóstico de piel',
  description: 'Respondé unas preguntas sobre tu piel y te armamos la rutina de mañana y de noche, con el motivo de cada producto.',
  alternates: { canonical: '/diagnostico' },
}

const YOU_GET = [
  { icon: FaceScan, text: 'Tu tipo de piel y en qué enfocarte' },
  { icon: Layers, text: 'Una rutina de mañana y otra de noche' },
  { icon: Bulb, text: 'El motivo de cada producto elegido' },
]

// The diagnosis arrives in Phase 3 (DIA-01). Until then the menu item lands
// here with an honest note and the ways to choose that already work, laid
// out as the design's diagnosis page: the text beside the campaign portrait
// with what the diagnosis will give.
export default async function DiagnosisPage() {
  const s = await getSettings()
  const img = lifestyleImage('diagnostico')
  return (
    <div className="container-page grid gap-12 pb-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-24">
      <section className="max-w-2xl lg:pt-8">
        <p className="eyebrow">Diagnóstico</p>
        <h1 className="mt-3 font-display text-display-lg text-balance">Tu rutina, pensada para tu piel</h1>
        <div className="mt-6 space-y-4 text-lede text-ink-soft">
          <p>
            Estamos terminando el diagnóstico: {s['copy.diagnosisQuestions']} preguntas sobre cómo se siente tu piel, y con eso te armamos la rutina de mañana y de noche, con el
            motivo de cada producto.
          </p>
          <p>Mientras tanto, podés elegir por lo que querés mejorar o filtrar los productos por tu tipo de piel.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/necesidades">
            Elegir por necesidad <ArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/productos" variant="secondary">
            Ver todos los productos
          </ButtonLink>
        </div>
        <p className="mt-12 text-sm text-ink-muted">{s['copy.healthNotice']}</p>
      </section>
      <aside aria-label="Qué vas a recibir">
        <div className="pb-10 lg:sticky lg:top-28">
          <div className="shape-arch relative mx-auto aspect-[4/5] max-w-[26rem] overflow-hidden bg-sand lg:max-w-none">
            <Image src={img.src} alt="" fill sizes="(min-width: 1280px) 448px, (min-width: 1024px) 384px, 90vw" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
          </div>
          <div className="relative mx-auto -mt-24 max-w-[24rem] rounded-[2rem] bg-paper p-6 shadow-[0_30px_60px_-36px_rgb(40_30_20/0.55)] ring-1 ring-line/60 lg:-ml-8 lg:mr-6 lg:max-w-none">
            <p className="font-display text-[1.35rem] leading-tight">Lo que vas a recibir</p>
            <ul className="mt-4 space-y-3">
              {YOU_GET.map(({ icon: I, text }) => (
                <li key={text} className="flex items-center gap-3 text-[0.9375rem]">
                  <IconBadge size="sm">
                    <I size={18} />
                  </IconBadge>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
