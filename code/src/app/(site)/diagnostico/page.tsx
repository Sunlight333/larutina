import type { Metadata } from 'next'
import { ButtonLink } from '@/components/ui/button'
import { getSettings } from '@/server/settings'

export const metadata: Metadata = {
  title: 'Diagnóstico de piel',
  description: 'Respondé unas preguntas sobre tu piel y te armamos la rutina de mañana y de noche, con el motivo de cada producto.',
  alternates: { canonical: '/diagnostico' },
}

// The diagnosis arrives in Phase 3 (DIA-01). Until then the menu item lands
// here with an honest note and the ways to choose that already work.
export default async function DiagnosisPage() {
  const s = await getSettings()
  return (
    <section className="container-page py-14 sm:py-20">
      <p className="eyebrow">Diagnóstico</p>
      <h1 className="mt-3 max-w-3xl font-display text-display-lg text-balance">Tu rutina, pensada para tu piel</h1>
      <div className="mt-6 max-w-2xl space-y-4 text-lede text-ink-soft">
        <p>
          Estamos terminando el diagnóstico: {s['copy.diagnosisQuestions']} preguntas sobre cómo se siente tu piel, y con eso te armamos la rutina de mañana y de noche, con el
          motivo de cada producto.
        </p>
        <p>Mientras tanto, podés elegir por lo que querés mejorar o filtrar los productos por tu tipo de piel.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/necesidades">Elegir por necesidad</ButtonLink>
        <ButtonLink href="/productos" variant="secondary">
          Ver todos los productos
        </ButtonLink>
      </div>
      <p className="mt-12 max-w-2xl text-sm text-ink-muted">{s['copy.healthNotice']}</p>
    </section>
  )
}
