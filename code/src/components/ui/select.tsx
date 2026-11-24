'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from '@/components/icons'

export type SelectOption = { value: string; label: string }

// The site's own dropdown, in place of the browser's: a pill button that opens
// a floating, softly shadowed list. A listbox for assistive technology, with
// the keyboard of a native select (arrows, Home/End, Enter/Space, Esc, typing
// a letter). Inside a form, a hidden input carries the value under `name`.
export function Select({
  options,
  value,
  defaultValue = '',
  onChange,
  name,
  placeholder = 'Elegí una opción',
  id,
  className = '',
  invalid,
  describedBy,
  labelledBy,
  size = 'md',
}: {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  placeholder?: string
  id?: string
  className?: string
  invalid?: boolean
  describedBy?: string
  labelledBy?: string
  size?: 'sm' | 'md'
}) {
  const [inner, setInner] = useState(defaultValue)
  const current = value ?? inner
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const auto = useId()
  const buttonId = id ?? `${auto}-button`
  const listId = `${auto}-list`
  const selected = options.find((o) => o.value === current)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    list.current?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    const i = options.findIndex((o) => o.value === current)
    setActive(i < 0 ? 0 : i)
    setOpen(true)
  }
  const choose = (i: number) => {
    const o = options[i]
    if (!o) return
    if (value === undefined) setInner(o.value)
    onChange?.(o.value)
    setOpen(false)
    button.current?.focus()
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }
  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(a + 1, last)),
      ArrowUp: () => setActive((a) => Math.max(a - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => {
        setOpen(false)
        button.current?.focus()
      },
      Tab: () => setOpen(false),
    }
    const run = keys[e.key]
    if (run) {
      if (e.key !== 'Tab') e.preventDefault()
      run()
      return
    }
    if (e.key.length === 1) {
      const k = e.key.toLowerCase()
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k))
      const i = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(k))
      if (i >= 0) setActive(i)
    }
  }

  const height = size === 'sm' ? 'h-11 text-[0.9375rem]' : 'h-13 text-base'

  return (
    <div ref={root} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={button}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy ? `${labelledBy} ${buttonId}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
        className={`flex w-full items-center justify-between gap-3 rounded-full border bg-paper pl-5 pr-3 text-left font-medium transition-[border-color,box-shadow] duration-200 hover:border-ink ${height} ${
          open ? 'border-ink shadow-[0_0_0_4px_var(--color-shell)]' : invalid ? 'border-accent-ink' : 'border-line-strong'
        }`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-ink-muted'}`}>{selected?.label ?? placeholder}</span>
        <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-shell transition-transform duration-300 ease-[var(--ease-out-soft)] ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={18} />
        </span>
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelledBy ?? buttonId}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="animate-pop absolute left-0 top-[calc(100%+0.5rem)] z-40 max-h-72 min-w-full overflow-y-auto rounded-[1.25rem_1.75rem_1.25rem_1.75rem] bg-paper p-1.5 shadow-[var(--shadow-float)] ring-1 ring-line outline-none"
        >
          {options.map((o, i) => {
            const on = o.value === current
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={on}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-4 whitespace-nowrap rounded-[1rem] px-4 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                  i === active ? 'bg-shell text-ink' : 'text-ink-soft'
                }`}
              >
                {o.label}
                <span className={`grid size-6 place-items-center rounded-full ${on ? 'bg-ink text-paper' : 'opacity-0'}`}>
                  <Check size={14} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
