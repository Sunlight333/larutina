import type { Metadata } from 'next'
import Image from 'next/image'
import { DiagnosisFlow, type PublicQuestion } from '@/components/diagnosis/diagnosis-flow'
import { Bulb, FaceScan, IconBadge, Layers } from '@/components/icons'
import { questions } from '@/lib/diagnosis/questions'
import { lifestyleImage } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Diagnóstico de piel',
  description: 'Seis preguntas para armar tu rutina de mañana y de noche.',
}

// Weights never reach the browser: the client gets prompts and options only.
const publicQuestions: PublicQuestion[] = questions.map(({ key, prompt, help, type, max, options }) => ({
  key,
  prompt,
  help,
  type,
  max,
  options: options.map(({ value, label }) => ({ value, label })),
}))

const YOU_GET = [
  { icon: FaceScan, text: 'Tu tipo de piel y en qué enfocarte' },
  { icon: Layers, text: 'Una rutina de mañana y otra de noche' },
  { icon: Bulb, text: 'El motivo de cada producto elegido' },
]

export default function DiagnosisPage() {
  const img = lifestyleImage('diagnostico')
  return (
    <div className="container-page grid gap-12 pt-6 pb-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-24">
      <div className="w-full max-w-2xl">
        <DiagnosisFlow questions={publicQuestions} />
      </div>
      <aside className="hidden lg:block" aria-label="Qué vas a recibir">
        <div className="sticky top-28 pb-10">
          <div className="shape-arch relative aspect-[4/5] overflow-hidden bg-sand">
            <Image src={img.src} alt="" fill sizes="(min-width: 1280px) 448px, 384px" placeholder="blur" blurDataURL={img.blur} className="object-cover" />
          </div>
          <div className="relative -mt-24 mr-6 -ml-8 rounded-[2rem] bg-paper p-6 shadow-[0_30px_60px_-36px_rgb(40_30_20/0.55)] ring-1 ring-line/60">
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
