'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Check } from './icons'

type ToastContext = { show: (message: string) => void }

const Ctx = createContext<ToastContext>({ show: () => {} })

export function useToast() {
  return useContext(Ctx)
}

/**
 * One polite live region for the whole app, so screen readers announce
 * "added to cart" style messages (spec §11.4).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((message: string) => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), message })
    timer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toast && (
          <div
            key={toast.id}
            className="animate-toast pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink px-5 py-4 text-[0.9375rem] leading-snug text-paper shadow-[0_18px_50px_-18px_rgb(30_20_10/0.6)]"
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-paper/15">
              <Check size={14} />
            </span>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}
