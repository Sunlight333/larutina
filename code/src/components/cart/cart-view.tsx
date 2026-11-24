'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Bag, Chat, Check, Close, FaceScan, IconBadge } from '@/components/icons'
import { ButtonLink, buttonClasses } from '@/components/ui/button'
import { ProductImage } from '@/components/catalog/product-image'
import { PageIntro } from '@/components/catalog/page-intro'
import { Tag, Truck } from '@/components/checkout/icons'
import { deliveryLine, errorText, fieldClass, leafPanel, NO_RATES, Notices, productos, stepOf, Totals } from '@/components/checkout/ui'
import { formatARS } from '@/lib/money'
import { CHECKOUT_ERRORS } from '@/lib/commerce/checkout-form'
import type { PublicQuote, ShopCart } from '@/server/commerce/cart-access'
import { applyCode, removeCode, removeLine, setLineQty, takeCart, useCartState } from './store'

type Props = {
  initial: ShopCart
  initialPostcode: string
  initialQuote: Extract<PublicQuote, { ok: true }> | null
  freeFromCents: number
  whatsapp: string | null
  paymentLine: string | null
}

// /carrito (BO-01 to BO-13): the server cart, its lines, free-shipping
// progress, code, shipping estimate, totals and the way to the checkout.
export function CartView({ initial, initialPostcode, initialQuote, freeFromCents, whatsapp, paymentLine }: Props) {
  const state = useCartState()
  const [seeded, setSeeded] = useState(false)
  // The page's cart is the freshest (it was fixed on this render): it replaces what the store had.
  useEffect(() => {
    takeCart(initial, initial.notices)
    setSeeded(true)
  }, [initial])
  const cart = seeded ? (state.cart ?? initial) : initial
  const notices = seeded ? state.notices : initial.notices
  const [quote, setQuote] = useState(initialQuote)
  const [chosen, setChosen] = useState<string | null>(initialQuote?.options[0]?.key ?? null)
  const option = quote?.options.find((o) => o.key === chosen) ?? null
  const n = cart.count

  const title = `Tu carrito · ${productos(n)}`

  if (!cart.lines.length) {
    return (
      <>
        <PageIntro title="Tu carrito" />
        <section className="container-page py-12 md:py-16">
          {notices.length > 0 && (
            <div className="mb-6">
              <Notices items={notices} />
            </div>
          )}
          <div className={`tex-linen relative overflow-hidden bg-shell px-6 py-14 text-center sm:py-20 ${leafPanel}`}>
            <IconBadge size="xl" tone="paper" className="mx-auto">
              <Bag />
            </IconBadge>
            <p className="mt-6 font-display text-display-sm">Tu carrito está vacío.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/productos" size="lg">
                Ver productos
              </ButtonLink>
              <ButtonLink href="/diagnostico" variant="secondary" size="lg">
                <FaceScan size={20} />
                Hacer mi diagnóstico
              </ButtonLink>
            </div>
          </div>
        </section>
      </>
    )
  }

  const shippingCents = option ? option.priceCents : null
  return (
    <>
      <PageIntro title={title} />
      <section className="container-page py-10 md:py-14" aria-label="Productos en tu carrito">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-14">
          <div className="min-w-0 space-y-5">
            <Notices items={notices} />
            {state.failed && <Notices tone="error" items={['No pudimos actualizar tu carrito. Revisá tu conexión y probá de nuevo.']} />}
            {freeFromCents > 0 && <FreeShipping freeFromCents={freeFromCents} goodsCents={cart.totalCents} />}
            <ul className="space-y-4">
              {cart.lines.map((l) => (
                <CartLine key={l.id} line={l} busy={state.busy} />
              ))}
            </ul>
          </div>

          <aside className="h-fit space-y-5 lg:sticky lg:top-28" aria-label="Resumen">
            <CodeForm cart={cart} />
            <ShippingCalculator
              initialPostcode={initialPostcode}
              quote={quote}
              chosen={chosen}
              onQuote={(q) => {
                setQuote(q)
                setChosen(q?.options[0]?.key ?? null)
              }}
              onChoose={setChosen}
              cartKey={`${cart.totalCents}:${cart.count}`}
            />
            <div className={`tex-linen bg-shell p-6 shadow-[var(--shadow-soft)] sm:p-7 ${leafPanel}`}>
              <Totals
                t={{
                  subtotalCents: cart.subtotalCents,
                  discountCents: cart.discountCents,
                  shippingCents,
                  shippingFree: option?.free,
                  totalCents: cart.totalCents + (shippingCents ?? 0),
                  transferTotalCents: cart.transferTotalCents != null ? cart.transferTotalCents + (shippingCents ?? 0) : null,
                }}
              />
              <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
                Continuar compra
                <ArrowRight size={20} />
              </ButtonLink>
              {paymentLine && <p className="mt-3 text-center text-sm text-ink-soft">{paymentLine}</p>}
            </div>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-full px-2 py-1 font-medium text-ink-soft transition-colors hover:text-ink">
                <IconBadge size="sm" tone="sage">
                  <Chat />
                </IconBadge>
                ¿Dudas antes de comprar? Escribinos
              </a>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

function FreeShipping({ freeFromCents, goodsCents }: { freeFromCents: number; goodsCents: number }) {
  const left = Math.max(0, freeFromCents - goodsCents)
  const pct = Math.min(100, Math.round((goodsCents / freeFromCents) * 100))
  return (
    <div className={`flex items-center gap-4 bg-sage-soft px-5 py-4 ${leafPanel}`}>
      <IconBadge size="md" tone="paper">
        <Truck />
      </IconBadge>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sage-ink" aria-live="polite">
          {left > 0 ? `Te faltan ${formatARS(left)} para el envío gratis.` : 'Tenés envío gratis.'}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper" aria-hidden="true">
          <div className="h-full rounded-full bg-sage-ink transition-[width] duration-500 ease-[var(--ease-out-soft)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function CartLine({ line: l, busy }: { line: ShopCart['lines'][number]; busy: boolean }) {
  const promo = l.unitChargedCents < l.unitPriceCents
  return (
    <li className="flex gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] bg-paper p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:gap-5 sm:p-4">
      <Link href={`/producto/${l.productCode}`} className="shape-arch block w-24 shrink-0 overflow-hidden sm:w-28" tabIndex={-1} aria-hidden="true">
        <ProductImage image={l.image} alt="" step={stepOf(l.stepLabel)} sizes="7rem" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{l.brand}</p>
          <Link href={`/producto/${l.productCode}`} className="mt-1 block text-[1.0625rem] font-semibold leading-snug hover:underline hover:decoration-line-strong hover:underline-offset-4">
            {l.name} · {l.sizeLabel}
          </Link>
          <p className="mt-1 text-sm text-ink-soft">
            {l.stepLabel} · {l.momentLabel.toLocaleLowerCase('es-AR')}
          </p>
          {l.presale && <p className="mt-1 text-sm font-semibold text-sage-ink">{l.presale}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex h-11 items-center rounded-full border border-line-strong bg-paper" role="group" aria-label={`Cantidad de ${l.name}`}>
              <button type="button" className="grid size-11 place-items-center rounded-full text-lg hover:bg-shell disabled:opacity-40" onClick={() => setLineQty(l.id, l.quantity - 1)} disabled={busy || l.quantity <= 1} aria-label="Restar uno">
                −
              </button>
              <span className="w-7 text-center font-semibold tabular" aria-live="polite">
                {l.quantity}
              </span>
              <button type="button" className="grid size-11 place-items-center rounded-full text-lg hover:bg-shell disabled:opacity-40" onClick={() => setLineQty(l.id, l.quantity + 1)} disabled={busy || l.quantity >= l.maxQty} aria-label="Sumar uno">
                +
              </button>
            </div>
            <button type="button" className="text-sm font-medium text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50" onClick={() => removeLine(l.id)} disabled={busy} aria-label={`Eliminar ${l.name}`}>
              Eliminar
            </button>
          </div>
        </div>
        <p className="tabular sm:pt-1 sm:text-right">
          <span className={`text-lg font-semibold ${promo ? 'text-accent-ink' : ''}`}>{formatARS(l.unitChargedCents * l.quantity)}</span>
          {promo && (
            <s className="block text-sm text-ink-muted">
              <span className="sr-only">Precio anterior: </span>
              {formatARS(l.unitPriceCents * l.quantity)}
            </s>
          )}
          {l.quantity > 1 && <span className="block text-xs text-ink-muted">{formatARS(l.unitChargedCents)} c/u</span>}
        </p>
      </div>
    </li>
  )
}

/** BO-06, BO-07. */
function CodeForm({ cart }: { cart: ShopCart }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ message?: string; error?: string } | null>(null)
  const applied = cart.couponCode && !cart.couponError

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setPending(true)
    const r = await applyCode(code)
    setPending(false)
    setResult(r ? { message: r.message, error: r.error } : { error: 'No pudimos aplicar el código. Revisá tu conexión y probá de nuevo.' })
    if (r?.message) setCode('')
  }

  return (
    <div className={`bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6 ${leafPanel}`}>
      <div className="flex items-center gap-3">
        <IconBadge size="sm">
          <Tag />
        </IconBadge>
        <label htmlFor={`${id}-code`} className="font-semibold leading-snug">
          ¿Tenés un código de descuento o de una embajadora?
        </label>
      </div>
      {applied ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-full bg-sage-soft py-2 pl-4 pr-2 text-sage-ink">
          <p className="flex items-center gap-2 text-sm font-semibold" role="status">
            <Check size={18} />
            Código {cart.couponCode} aplicado.
          </p>
          <button type="button" onClick={() => void removeCode().then(() => setResult(null))} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label={`Quitar el código ${cart.couponCode}`}>
            <Close size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex gap-2" noValidate>
          <input
            id={`${id}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-invalid={!!(result?.error || cart.couponError) || undefined}
            aria-describedby={`${id}-code-msg`}
            className={`${fieldClass} h-12 min-w-0 flex-1 uppercase tracking-wide`}
          />
          <button type="submit" disabled={pending || !code.trim()} className={buttonClasses('primary', 'md', 'shrink-0 px-5')}>
            {pending ? '…' : 'Aplicar'}
          </button>
        </form>
      )}
      <div id={`${id}-code-msg`} aria-live="polite">
        {!applied && (result?.error || cart.couponError) && <p className={`mt-2 ${errorText}`}>{result?.error ?? cart.couponError}</p>}
        {applied && cart.codeOutdone && <p className="mt-2 text-sm text-ink-soft">Tu rutina ya tiene un descuento mayor.</p>}
      </div>
    </div>
  )
}

/** BO-08: "Calculá el envío", the options cheapest first, the chosen one in the totals. */
function ShippingCalculator({
  initialPostcode,
  quote,
  chosen,
  onQuote,
  onChoose,
  cartKey,
}: {
  initialPostcode: string
  quote: Extract<PublicQuote, { ok: true }> | null
  chosen: string | null
  onQuote: (q: Extract<PublicQuote, { ok: true }> | null) => void
  onChoose: (key: string) => void
  cartKey: string
}) {
  const id = useId()
  const [postcode, setPostcode] = useState(initialPostcode)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quoted = useRef(initialPostcode)

  const run = async (pc: string) => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/cart/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postcode: pc }) })
      const q = (await res.json()) as PublicQuote & { error?: string }
      if (q.ok) {
        quoted.current = pc
        onQuote(q)
      } else {
        onQuote(null)
        setError(q.error === 'postcode' ? CHECKOUT_ERRORS.postcode : q.error === 'no-rates' ? NO_RATES : typeof q.error === 'string' && q.error.length > 12 ? q.error : null)
      }
    } catch {
      setError('No pudimos calcular el envío. Revisá tu conexión y probá de nuevo.')
    } finally {
      setPending(false)
    }
  }

  // The cart changed (quantities, a code): the estimate follows it.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (quoted.current) void run(quoted.current)
  }, [cartKey])

  return (
    <div className={`bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6 ${leafPanel}`}>
      <div className="flex items-center gap-3">
        <IconBadge size="sm" tone="sage">
          <Truck />
        </IconBadge>
        <p className="font-semibold" id={`${id}-title`}>
          Calculá el envío
        </p>
      </div>
      <form
        className="mt-4 flex gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (postcode.trim()) void run(postcode.trim())
        }}
      >
        <label htmlFor={`${id}-pc`} className="sr-only">
          Código postal
        </label>
        <input
          id={`${id}-pc`}
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          inputMode="text"
          autoComplete="postal-code"
          placeholder="Código postal"
          maxLength={12}
          aria-invalid={!!error || undefined}
          aria-describedby={`${id}-pc-msg`}
          className={`${fieldClass} h-12 min-w-0 flex-1`}
        />
        <button type="submit" disabled={pending || !postcode.trim()} className={buttonClasses('secondary', 'md', 'shrink-0 px-5')}>
          {pending ? '…' : 'Calcular'}
        </button>
      </form>
      <div id={`${id}-pc-msg`} aria-live="polite">
        {error && <p className={`mt-2 ${errorText}`}>{error}</p>}
      </div>
      {quote && quote.options.length > 0 && (
        <fieldset className="mt-4 space-y-2" aria-labelledby={`${id}-title`}>
          {quote.options.map((o) => (
            <label key={o.key} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${chosen === o.key ? 'border-ink bg-shell' : 'border-line hover:border-line-strong'}`}>
              <input type="radio" name={`${id}-ship`} checked={chosen === o.key} onChange={() => onChoose(o.key)} />
              <span className="min-w-0 flex-1 text-sm leading-snug">{deliveryLine(o)}</span>
              <span className="text-right text-sm font-semibold tabular">
                {o.free ? (
                  <>
                    <s className="block text-xs font-normal text-ink-muted">{formatARS(o.originalPriceCents)}</s>
                    Gratis
                  </>
                ) : (
                  formatARS(o.priceCents)
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}
