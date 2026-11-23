'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Close, Search } from '@/components/icons'
import type { SuggestResult } from '@/server/search/types'

type Option = { id: string; label: string; detail?: string; href: string; group?: string }

// NAV-06, G-04: the header search. A button opens an overlay (full screen on
// phones) with a combobox following the ARIA 1.2 pattern: suggestions load
// while typing (debounced), arrows move through them, Enter opens one or
// searches, Esc closes. Without JavaScript the button is a link to /buscar.
// `compact`: an icon button only (the header puts it in a capsule with the cart).
export function SearchBox({ placeholder, compact = false }: { placeholder: string; compact?: boolean }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<SuggestResult | null>(null)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)

  const open = () => {
    dialog.current?.showModal()
    input.current?.focus()
    input.current?.select()
  }
  const close = () => dialog.current?.close()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResult(null)
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SuggestResult | null) => {
          setResult(data)
          setActive(-1)
          setLoading(false)
        })
        .catch(() => {})
    }, 160)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const term = q.trim()
  const options: Option[] = []
  if (result?.seeAll) options.push({ id: 'ver-todo', label: result.seeAll.label, href: result.seeAll.href })
  for (const g of result?.groups ?? []) for (const it of g.items) options.push({ ...it, group: g.label })
  if (term.length >= 2) options.push({ id: 'buscar', label: `Ver todos los resultados para “${term}”`, href: `/buscar?q=${encodeURIComponent(term)}` })

  const go = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [router],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      const opt = options[active]
      if (opt) {
        e.preventDefault()
        go(opt.href)
      }
    } else if (e.key === 'Home' && active >= 0) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End' && active >= 0) {
      e.preventDefault()
      setActive(options.length - 1)
    }
  }

  const expanded = term.length >= 2 && options.length > 0
  const optionId = (i: number) => `${listId}-o${i}`
  let index = -1
  const renderOption = (o: Option) => {
    index++
    const i = index
    const selected = i === active
    return (
      <li
        key={o.id}
        id={optionId(i)}
        role="option"
        aria-selected={selected}
        onMouseMove={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(o.href)}
        className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 ${selected ? 'bg-shell' : ''}`}
      >
        <span className="min-w-0">
          <span className="block truncate">{o.label}</span>
          {o.detail && <span className="block truncate text-xs text-ink-muted">{o.detail}</span>}
        </span>
        {(o.id === 'ver-todo' || o.id === 'buscar') && <ArrowRight size={16} className="shrink-0 text-ink-muted" />}
      </li>
    )
  }

  const seeAll = options.find((o) => o.id === 'ver-todo')
  const searchAll = options.find((o) => o.id === 'buscar')
  const count = options.length - (searchAll ? 1 : 0)

  return (
    <>
      <a
        href="/buscar"
        onClick={(e) => {
          e.preventDefault()
          open()
        }}
        aria-label="Buscar"
        aria-haspopup="dialog"
        className={
          compact
            ? 'grid size-11 place-items-center rounded-full hover:bg-shell'
            : 'grid size-10 place-items-center rounded-full hover:bg-shell lg:flex lg:h-10 lg:w-56 lg:items-center lg:justify-start lg:gap-2 lg:rounded-full lg:border lg:border-line lg:px-4 lg:text-sm lg:text-ink-muted lg:hover:border-line-strong lg:hover:bg-paper xl:w-64'
        }
      >
        <Search size={23} className="shrink-0" />
        {!compact && <span className="hidden truncate lg:inline">{placeholder}</span>}
      </a>

      <dialog
        ref={dialog}
        aria-label="Buscar"
        onClick={(e) => {
          if (e.target === dialog.current) close()
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-ink/30 md:h-auto md:max-h-[85dvh] md:rounded-b-3xl md:shadow-2xl open:flex open:flex-col"
      >
        <form
          role="search"
          action="/buscar"
          method="get"
          className="container-page flex items-center gap-3 border-b border-line py-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (term) go(`/buscar?q=${encodeURIComponent(term)}`)
          }}
        >
          <Search size={20} className="shrink-0 text-ink-muted" />
          <label htmlFor={`${listId}-input`} className="sr-only">
            Buscar
          </label>
          <input
            ref={input}
            id={`${listId}-input`}
            name="q"
            type="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={100}
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={`${listId}-list`}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
          <button type="button" onClick={close} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-shell" aria-label="Cerrar la búsqueda">
            <Close size={20} />
          </button>
        </form>

        <div className="container-page flex-1 overflow-y-auto py-3">
          <p className="sr-only" role="status" aria-live="polite">
            {term.length >= 2 && !loading ? (count ? `${count} sugerencias` : 'Sin sugerencias') : ''}
          </p>
          <ul id={`${listId}-list`} role="listbox" aria-label="Sugerencias" className={expanded ? 'pb-4' : 'hidden'}>
            {seeAll && <li role="presentation" className="pb-2">
              <ul role="group" aria-label="Necesidad">
                {renderOption(seeAll)}
              </ul>
            </li>}
            {(result?.groups ?? []).map((g) => (
              <li key={g.kind} role="presentation" className="pt-2">
                <p id={`${listId}-${g.kind}`} className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-muted" aria-hidden="true">
                  {g.label}
                </p>
                <ul role="group" aria-labelledby={`${listId}-${g.kind}`}>
                  {g.items.map((it) => renderOption({ ...it, group: g.label }))}
                </ul>
              </li>
            ))}
            {searchAll && (
              <li role="presentation" className="mt-2 border-t border-line pt-2">
                <ul role="group" aria-label="Buscar">
                  {renderOption(searchAll)}
                </ul>
              </li>
            )}
          </ul>
          {term.length < 2 && <p className="px-3 py-2 text-sm text-ink-muted">Probá con un producto, una marca, un ingrediente o lo que querés mejorar.</p>}
          {term.length >= 2 && !loading && result && result.groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-muted">
              No encontramos nada con “{term}”. Probá con otra palabra, o{' '}
              <a href="/diagnostico" className="underline underline-offset-2" onClick={(e) => { e.preventDefault(); go('/diagnostico') }}>
                hacé el diagnóstico
              </a>{' '}
              y te armamos la rutina.
            </p>
          )}
        </div>
      </dialog>
    </>
  )
}
