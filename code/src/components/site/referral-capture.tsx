'use client'

import { useEffect, useState } from 'react'
import { Close, Sparkle } from '@/components/icons'

const SEEN = 'lr_ref_banner'

// G-10, NAV-10: arriving with ?ref=CODE saves her code (api/ref) and shows,
// once, who recommended the site. The parameter is then taken out of the
// address so a shared link does not carry it further by accident.
export function ReferralCapture() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('ref')
    if (!code) return
    url.searchParams.delete('ref')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    fetch('/api/ref', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, path: url.pathname }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string } | null) => {
        if (!d?.name) return
        try {
          if (sessionStorage.getItem(SEEN) === code.toUpperCase()) return
          sessionStorage.setItem(SEEN, code.toUpperCase())
        } catch {}
        setName(d.name)
      })
      .catch(() => {})
  }, [])

  if (!name) return null
  return (
    <div role="status" className="animate-rise fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-[1.25rem_2.5rem_1.25rem_2.5rem] bg-paper py-3 pl-3 pr-2 shadow-[var(--shadow-float)] ring-1 ring-line sm:bottom-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Sparkle size={22} />
      </span>
      <p className="flex-1 text-[0.9375rem] leading-snug text-ink">Llegaste por recomendación de {name}. Su código ya queda guardado para tu compra.</p>
      <button type="button" aria-label="Cerrar" onClick={() => setName(null)} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-shell hover:text-ink">
        <Close size={18} />
      </button>
    </div>
  )
}
