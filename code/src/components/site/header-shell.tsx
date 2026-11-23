'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// The sticky header, compacted once the page scrolls: the large medallion
// shrinks into the bar so it never covers content while reading.
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const ticking = useRef(false)

  useEffect(() => {
    const update = () => {
      ticking.current = false
      setScrolled(window.scrollY > 24)
    }
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header data-scrolled={scrolled} className="group/header sticky top-0 z-40">
      {children}
    </header>
  )
}
