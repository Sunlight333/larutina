'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { submitDiagnosis } from '@/app/diagnostico/actions'
import { ArrowLeft, ArrowRight, Check } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'

// What the client needs from a question: no weights. Scoring stays on the server.
export type PublicQuestion = {
  key: string
  prompt: string
  help: string
  type: 'single' | 'multi'
  max?: number
  options: { value: string; label: string }[]
}

const ADVANCE_DELAY = 280

/**
 * One question per screen. Answers live in memory until the last one, then a
 * single server action stores everything and redirects to the result. A
 * refresh mid-flow simply starts again at question 1.
 */
export function DiagnosisFlow({ questions }: { questions: PublicQuestion[] }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mounted = useRef(false)

  const question = questions[index]!
  const total = questions.length
  const selected = answers[question.key] ?? []
  const isLast = index === total - 1
  const limit = question.type === 'multi' ? (question.max ?? question.options.length) : 1

  // A concern tile on the home page arrives as ?foco=<slug>; preselect it in the
  // goals question when it is one of the options.
  useEffect(() => {
    const foco = new URLSearchParams(window.location.search).get('foco')
    const goals = questions.find((q) => q.type === 'multi')
    if (foco && goals?.options.some((o) => o.value === foco)) {
      setAnswers((a) => ({ ...a, [goals.key]: [foco] }))
    }
  }, [questions])

  // Move focus to each new question so keyboard and screen reader users land
  // on it; skip the first render so the page does not jump on load.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    headingRef.current?.focus({ preventScroll: true })
    if (headingRef.current && headingRef.current.getBoundingClientRect().top < 0) {
      headingRef.current.scrollIntoView({ block: 'center' })
    }
  }, [index])

  useEffect(() => () => clearTimeout(advance.current), [])

  function submit(all: Record<string, string[]>) {
    setError(null)
    startTransition(async () => {
      const result = await submitDiagnosis(questions.map((q) => ({ questionKey: q.key, values: all[q.key] ?? [] })))
      if (result?.error) setError(result.error)
    })
  }

  function choose(value: string) {
    if (pending) return
    if (question.type === 'single') {
      const next = { ...answers, [question.key]: [value] }
      setAnswers(next)
      // A short pause so the choice registers visually before moving on.
      clearTimeout(advance.current)
      advance.current = setTimeout(() => (isLast ? submit(next) : setIndex((i) => i + 1)), ADVANCE_DELAY)
      return
    }
    const on = selected.includes(value)
    if (!on && selected.length >= limit) return
    setAnswers({ ...answers, [question.key]: on ? selected.filter((v) => v !== value) : [...selected, value] })
  }

  function next() {
    if (selected.length === 0) return
    if (isLast) submit(answers)
    else setIndex((i) => i + 1)
  }

  function back() {
    clearTimeout(advance.current)
    setError(null)
    setIndex((i) => Math.max(0, i - 1))
  }

  if (pending) {
    return (
      <div className="animate-fade flex min-h-[26rem] flex-col items-center justify-center py-16 text-center" role="status">
        <span className="relative flex size-14 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
          <span className="size-3 rounded-full bg-accent" />
        </span>
        <p className="mt-8 font-display text-display-sm">Armando tu rutina…</p>
        <p className="mt-2 max-w-sm text-ink-muted">Cruzamos tus respuestas con los activos, el tipo de piel y las combinaciones de cada producto.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex h-10 items-center justify-between gap-4">
        <button
          type="button"
          onClick={back}
          className={`-ml-2 inline-flex h-10 items-center gap-2 rounded-full px-3 text-[0.9375rem] text-ink-soft hover:bg-shell hover:text-ink ${index === 0 ? 'invisible' : ''}`}
          aria-hidden={index === 0}
          tabIndex={index === 0 ? -1 : 0}
        >
          <ArrowLeft size={18} />
          Anterior
        </button>
        <p className="tabular text-sm text-ink-muted">
          Pregunta {index + 1} de {total}
        </p>
      </div>
      <div
        className="mt-3 h-[3px] overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Progreso del diagnóstico"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <section key={question.key} className="animate-rise mt-10 sm:mt-14" aria-labelledby={`q-${question.key}`}>
        <h1 id={`q-${question.key}`} ref={headingRef} tabIndex={-1} className="font-display text-display-md text-balance outline-none">
          {question.prompt}
        </h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-ink-muted">{question.help}</p>
        {question.type === 'multi' && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-shell px-3 py-1 text-sm font-medium">
            Elegí hasta {limit}
            <span className="tabular text-ink-muted">
              · {selected.length} de {limit}
            </span>
          </p>
        )}

        <div className="mt-8 grid gap-3" role="group" aria-labelledby={`q-${question.key}`}>
          {question.options.map((o) => {
            const on = selected.includes(o.value)
            const blocked = question.type === 'multi' && !on && selected.length >= limit
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                disabled={blocked}
                onClick={() => choose(o.value)}
                className={`group flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left text-[1.0625rem] leading-snug transition-[border-color,background-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? 'border-ink bg-shell' : 'border-line-strong/70 bg-paper hover:border-ink/50'
                }`}
              >
                <span>{o.label}</span>
                <Indicator on={on} multi={question.type === 'multi'} />
              </button>
            )
          })}
        </div>

        {question.type === 'multi' && (
          // On phones the button follows the thumb: pinned to the bottom edge.
          <div className="sticky bottom-0 -mx-4 mt-4 flex justify-end bg-linear-to-t from-paper from-60% to-paper/0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mt-8 sm:bg-none sm:p-0">
            <button type="button" onClick={next} disabled={selected.length === 0} className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}>
              {isLast ? 'Ver mi rutina' : 'Continuar'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-4 text-[0.9375rem]" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => submit(answers)} className={buttonClasses('primary', 'sm')}>
              Reintentar
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function Indicator({ on, multi }: { on: boolean; multi: boolean }) {
  const shape = multi ? 'rounded-md' : 'rounded-full'
  return (
    <span
      aria-hidden="true"
      className={`grid size-6 shrink-0 place-items-center border transition-colors duration-200 ${shape} ${
        on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-transparent group-hover:border-ink/50'
      }`}
    >
      <Check size={14} strokeWidth={2.2} />
    </span>
  )
}
