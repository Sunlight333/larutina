'use client'

import { useEffect } from 'react'
import { buttonClasses } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section className="container-page py-16 md:py-24">
      <p className="eyebrow">Algo salió mal</p>
      <h1 className="mt-4 max-w-2xl font-display text-display-lg text-balance">No pudimos cargar esta página.</h1>
      <p className="mt-5 max-w-lg text-lede text-ink-soft">Suele ser algo momentáneo. Probá de nuevo en unos segundos.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonClasses('primary')}>
          Reintentar
        </button>
        <a href="/" className={buttonClasses('secondary')}>
          Ir al inicio
        </a>
      </div>
    </section>
  )
}
