'use client'

import { useState } from 'react'
import { adminButton } from './ui'

/** Copies a text (a media key or URL) to the clipboard and says so. */
export function CopyButton({ text, label = 'Copiar', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={`${adminButton('ghost')} h-7 px-2 text-xs ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          window.prompt('Copiá el texto:', text)
        }
      }}
    >
      <span aria-live="polite">{done ? 'Copiado' : label}</span>
    </button>
  )
}
