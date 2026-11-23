'use client'

import { useEffect, useRef } from 'react'

/**
 * Put inside an <AdminForm> whose fields are long texts (pages, articles,
 * legal documents). React resets a form after every action, also when the
 * action returns validation errors, which would throw away what was typed.
 * This cancels that reset, so the fields keep their values; after a
 * successful save they already match what was stored. File inputs should be
 * keyed by the stored value so a finished upload clears them.
 */
export function KeepFormValues() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    const keep = (e: Event) => e.preventDefault()
    form.addEventListener('reset', keep)
    return () => form.removeEventListener('reset', keep)
  }, [])
  return <span ref={ref} hidden />
}
