'use client'

import { useEffect, useRef } from 'react'

/**
 * Put inside an <AdminForm>: React resets a form after every action, also
 * when the action returns validation errors, so what the user typed in a
 * long form is lost. This cancels that reset (the native reset event is
 * cancelable); after a successful save the fields already show what was
 * saved. Forms with resetOnSuccess still start empty, since they remount.
 */
export function KeepInput() {
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
