'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Heart } from '@/components/icons'
import { toggleFavoriteAction } from '@/app/(site)/producto/actions'

// F-08: the heart, "Guardar". Signed in, it saves or removes at once.
// Signed out it says 'Ingresá para guardar tus favoritos.', and the link
// brings her back here with the product saved (PDP-09).
export function FavoriteButton({
  productId,
  saved: initial,
  signedIn,
  signInHref,
  variant = 'pill',
  refreshPage = false,
}: {
  productId: string
  saved: boolean
  signedIn: boolean
  signInHref: string
  variant?: 'pill' | 'round'
  refreshPage?: boolean
}) {
  const [saved, setSaved] = useState(initial)
  const [askSignIn, setAskSignIn] = useState(false)
  const [pending, start] = useTransition()

  const toggle = () => {
    if (!signedIn) {
      setAskSignIn(true)
      return
    }
    const next = !saved
    setSaved(next) // the heart answers at once; the server confirms
    start(async () => {
      const r = await toggleFavoriteAction(productId, refreshPage)
      if (!r.signedIn) {
        setSaved(false)
        setAskSignIn(true)
      } else setSaved(r.saved)
    })
  }

  const heart = <Heart size={variant === 'round' ? 22 : 21} filled={saved} className={`transition-transform duration-300 ease-[var(--ease-out-soft)] ${saved ? 'scale-110 text-accent-ink' : ''}`} />

  return (
    <div className={variant === 'pill' ? 'relative' : 'contents'}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={signedIn ? saved : undefined}
        aria-expanded={signedIn ? undefined : askSignIn}
        disabled={pending}
        className={
          variant === 'round'
            ? 'grid size-11 place-items-center rounded-full bg-paper/90 text-ink shadow-[var(--shadow-soft)] backdrop-blur transition-transform hover:scale-105 disabled:opacity-70'
            : `inline-flex h-12 items-center gap-2 rounded-full border px-5 text-[0.9375rem] font-semibold transition-colors disabled:opacity-70 ${saved ? 'border-accent/40 bg-accent-soft text-accent-ink' : 'border-line-strong bg-paper text-ink hover:border-ink'}`
        }
        aria-label={variant === 'round' ? 'Guardar' : undefined}
      >
        {heart}
        {variant === 'pill' && 'Guardar'}
      </button>
      {askSignIn && (
        <p role="status" className="animate-pop mt-2 text-[0.9375rem]">
          <Link href={signInHref} className="inline-flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-2.5 font-medium text-accent-ink underline-offset-4 hover:underline">
            Ingresá para guardar tus favoritos.
          </Link>
        </p>
      )}
    </div>
  )
}
