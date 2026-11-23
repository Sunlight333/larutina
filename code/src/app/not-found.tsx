import { ButtonLink } from '@/components/ui/button'

// G-15.
export default function NotFound() {
  return (
    <main id="contenido" className="container-page flex flex-1 flex-col justify-center py-24">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 max-w-2xl font-display text-display-lg text-balance">Esta página no existe, o ya no está.</h1>
      <p className="mt-5 max-w-lg text-lede text-ink-soft">Volvé al inicio o hacé tu diagnóstico.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">Ir al inicio</ButtonLink>
        <ButtonLink href="/diagnostico" variant="secondary">
          Hacer mi diagnóstico
        </ButtonLink>
      </div>
    </main>
  )
}
