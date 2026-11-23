'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Close } from '@/components/icons'
import { WAITLIST_JOINED } from '@/lib/waitlist'

// GEN-08 as a window over the site: shown once to visitors while waitlist mode
// is on, and skippable (the close button, "Ahora no", Esc or a click outside).
// Skipping hides it for 7 days on this device; joining the list hides it for
// good. Browser storage only holds that convenience: if it is unavailable,
// the window simply shows again.

const DISMISSED = 'lr_waitlist_dismissed'
// WAITLIST_JOINED: set by the sign-up form (src/lib/waitlist.ts).
const SKIP_DAYS = 7

function shouldShow() {
  try {
    if (localStorage.getItem(WAITLIST_JOINED)) return false
    const at = Number(localStorage.getItem(DISMISSED))
    return !at || Date.now() - at > SKIP_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return true
  }
}

export function WaitlistModal({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!shouldShow()) return
    const t = setTimeout(() => {
      dialog.current?.showModal()
      // Start on the content, not on the close button, so nothing looks pressed.
      content.current?.focus()
    }, 500)
    return () => clearTimeout(t)
  }, [])

  const close = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      aria-labelledby="lista-de-espera-titulo"
      onClose={() => {
        try {
          if (!localStorage.getItem(WAITLIST_JOINED)) localStorage.setItem(DISMISSED, String(Date.now()))
        } catch {}
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[34rem] overflow-visible rounded-[2rem] bg-transparent p-0 text-ink backdrop:bg-night-deep/55 backdrop:backdrop-blur-[3px] open:animate-rise"
    >
      <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[2rem] bg-paper px-6 pb-8 pt-10 shadow-[0_40px_120px_-30px_rgb(43_30_23/0.6)] ring-1 ring-line sm:px-10 sm:pb-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-10 mx-auto size-[26rem] rounded-full bg-[radial-gradient(closest-side,var(--color-accent-soft),transparent)]" />
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full text-ink-soft transition-colors hover:bg-shell hover:text-ink"
        >
          <Close size={22} />
        </button>
        <div ref={content} tabIndex={-1} className="relative outline-none">
          {children}
        </div>
        <div className="relative mt-6 text-center">
          <button type="button" onClick={close} className="text-[0.875rem] font-semibold uppercase tracking-[0.12em] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Ahora no, ver el sitio
          </button>
        </div>
      </div>
    </dialog>
  )
}
