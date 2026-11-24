'use client'

import { useEffect } from 'react'

// Reveal effects. Any element with data-reveal ("up", "scale", "clip", "left"
// or "right") eases in the first time it comes into view; a --i style on it
// staggers siblings (globals.css). Only once this observer runs does the page
// get html.reveal-on, which is what hides the waiting elements: without
// scripts, or before hydration, everything is simply visible. Elements already
// on screen at that moment are marked shown first, so nothing above the fold
// ever blinks. With reduced motion everything shows at once.

const SELECTOR = '[data-reveal]:not([data-shown])'

export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement
    const show = (el: Element) => el.setAttribute('data-shown', '')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      document.querySelectorAll(SELECTOR).forEach(show)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show(e.target)
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    const inView = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    }
    const scan = (initial: boolean) => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (initial && inView(el)) show(el)
        else io.observe(el)
      })
    }

    scan(true)
    root.classList.add('reveal-on')
    // Pages reached by client navigation bring new elements.
    const mo = new MutationObserver(() => scan(false))
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return null
}
