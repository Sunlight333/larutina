'use client'

import { useEffect, useState } from 'react'
import { Close } from '@/components/icons'
import type { ActiveAnnouncement } from '@/server/services/site'

// NAV-01, G-01: rotating messages, closable for the session.
export function AnnouncementBar({ messages }: { messages: ActiveAnnouncement[] }) {
  const [index, setIndex] = useState(0)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem('lr_announcements_closed') === '1') setClosed(true)
    } catch {}
  }, [])

  useEffect(() => {
    if (messages.length < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 6000)
    return () => clearInterval(t)
  }, [messages.length])

  if (closed || messages.length === 0) return null
  const m = messages[index % messages.length]!
  return (
    <div className="relative bg-ink px-10 py-2 text-center text-[0.8125rem] text-paper">
      <p aria-live="polite">{m.href ? <a href={m.href} className="underline-offset-2 hover:underline">{m.text}</a> : m.text}</p>
      <button
        type="button"
        aria-label="Cerrar anuncios"
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-paper/10"
        onClick={() => {
          setClosed(true)
          try {
            sessionStorage.setItem('lr_announcements_closed', '1')
          } catch {}
        }}
      >
        <Close size={14} />
      </button>
    </div>
  )
}
