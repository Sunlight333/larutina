'use client'

import { useRef, type ReactNode } from 'react'

// A layered 3D tilt that follows the pointer: the card leans towards it a few
// degrees and its shadow deepens (the `tilt` utility in globals.css). Mouse
// and pen only; touch and reduced motion get the flat card.
export function Tilt({ children, className = '', max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`)
      el.dataset.tilting = ''
    })
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frame.current)
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    delete el.dataset.tilting
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className}`}>
      {children}
    </div>
  )
}
