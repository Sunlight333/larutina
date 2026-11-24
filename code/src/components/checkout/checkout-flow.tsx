'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, IconBadge, ShieldCheck } from '@/components/icons'
import { buttonClasses } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ProductImage } from '@/components/catalog/product-image'
import { takeCart, useCartState } from '@/components/cart/store'
import { formatARS } from '@/lib/money'
import { PROVINCE_OPTIONS, PROVINCES, provincesForPostcode, isProvince, formatCuit, normalizeCuit } from '@/lib/argentina'
import { CHECKOUT_ERRORS, validateContact, type CheckoutContact, type FieldErrors } from '@/lib/commerce/checkout-form'
import type { PublicQuote, ShopCart } from '@/server/commerce/cart-access'
import type { PaymentChoice } from '@/server/commerce/checkout'
import { placeOrderAction, saveCheckoutEmail } from '@/app/(checkout)/checkout/actions'
import { Bank, Box, Card, Pencil, Truck, User } from './icons'
import { deliveryLine, errorText, fieldClass, leafPanel, NO_RATES, Notices, productos, stepOf, Totals } from './ui'

type Props = {
  initialCart: ShopCart
  initialContact: CheckoutContact
  signedIn: boolean
  methods: PaymentChoice[]
  transferPct: number
  transferHours: number
  brandName: string
}

const STEPS = ['Tus datos', 'Envío', 'Pago', 'Revisión'] as const // CK-02
const STEP1: (keyof CheckoutContact)[] = ['email', 'firstName', 'lastName', 'dni', 'phone', 'street', 'unit', 'postcode', 'locality', 'province', 'notes']
const STEP3: (keyof CheckoutContact)[] = ['cuit', 'businessName']
const TERMS_ERROR = 'Para seguir, aceptá los Términos y condiciones y la Política de privacidad.'
const NETWORK = 'No pudimos conectar. Revisá tu conexión y probá de nuevo.'

type Quote = PublicQuote | null

// CK-01 to CK-18: four steps on one page, the summary beside them (CK-14).
// Each field is checked as she types with the same rules the server applies
// (CK-05), and the message sits next to the field.
export function CheckoutFlow({ initialCart, initialContact, signedIn, methods, transferPct, transferHours, brandName }: Props) {
  const router = useRouter()
  const store = useCartState()
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    takeCart(initialCart, initialCart.notices)
    setSeeded(true)
  }, [initialCart])
  const cart = seeded ? (store.cart ?? initialCart) : initialCart
  const notices = seeded ? store.notices : initialCart.notices

  const [step, setStep] = useState(1)
  const [reached, setReached] = useState(1)
  const [contact, setContact] = useState(initialContact)
  const [touched, setTouched] = useState<ReadonlySet<keyof CheckoutContact>>(new Set())
  const checked = useMemo(() => validateContact(contact), [contact])
  const errors: FieldErrors = checked.ok ? {} : checked.errors
  const err = (k: keyof CheckoutContact) => (touched.has(k) ? errors[k] : undefined)
  const touch = (keys: (keyof CheckoutContact)[]) => setTouched((t) => new Set([...t, ...keys]))

  const [quote, setQuote] = useState<Quote>(null)
  const [quoting, setQuoting] = useState(false)
  const quotedFor = useRef('')
  const [shippingKey, setShippingKey] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentChoice | null>(methods[0] ?? null)
  const [terms, setTerms] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const top = useRef<HTMLDivElement>(null)

  const option = quote?.ok ? (quote.options.find((o) => o.key === shippingKey) ?? null) : null
  const quoteKey = `${contact.postcode.trim().toUpperCase()}|${contact.province}|${cart.totalCents}|${cart.count}`

  const go = (n: number) => {
    setStep(n)
    setReached((r) => Math.max(r, n))
    setFailure(null)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const fetchQuote = async () => {
    if (quotedFor.current === quoteKey) return
    setQuoting(true)
    try {
      const res = await fetch('/api/cart/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postcode: contact.postcode, province: contact.province }) })
      const q = (await res.json()) as PublicQuote
      quotedFor.current = quoteKey
      setQuote(q)
      if (q.ok) setShippingKey((k) => (k && q.options.some((o) => o.key === k) ? k : (q.options[0]?.key ?? null)))
      else setShippingKey(null)
    } catch {
      setQuote(null)
      setFailure(NETWORK)
    } finally {
      setQuoting(false)
    }
  }

  // The cart changed after a step (a notice, CK-18): the shipping quote follows it.
  useEffect(() => {
    if (step >= 2 && quotedFor.current && quotedFor.current !== quoteKey) void fetchQuote()
  }, [quoteKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const firstInvalid = (keys: (keyof CheckoutContact)[]) => keys.find((k) => errors[k])

  const continue1 = () => {
    touch(STEP1)
    const bad = firstInvalid(STEP1)
    if (bad) {
      document.getElementById(`ck-${bad}`)?.focus()
      return
    }
    void saveCheckoutEmail(contact.email).catch(() => {})
    void fetchQuote()
    go(2)
  }
  const continue2 = () => {
    if (option) go(3)
  }
  const continue3 = () => {
    if (!method) return
    if (contact.wantsInvoiceA) {
      touch(STEP3)
      const bad = firstInvalid(STEP3)
      if (bad) {
        document.getElementById(`ck-${bad}`)?.focus()
        return
      }
    }
    go(4)
  }

  const place = async () => {
    if (!terms) {
      setTermsError(TERMS_ERROR)
      return
    }
    if (!option || !method) return
    setPlacing(true)
    setFailure(null)
    try {
      const r = await placeOrderAction({ contact, shippingKey: option.key, method, acceptedTerms: terms })
      if (r.ok) {
        window.location.assign(r.redirect)
        return
      }
      if ('errors' in r) {
        const keys = Object.keys(r.errors) as (keyof CheckoutContact)[]
        touch(keys)
        go(keys.some((k) => STEP1.includes(k)) ? 1 : 3)
      } else if (r.reason === 'empty') {
        router.push('/carrito')
        return
      } else if (r.reason === 'shipping') {
        quotedFor.current = ''
        go(2)
        void fetchQuote()
        setFailure(r.message)
      } else if (r.reason === 'method') {
        go(3)
        setFailure(r.message)
      } else if (r.reason === 'terms') {
        setTermsError(r.message)
      } else if ('cart' in r && r.cart) {
        // CK-18 and BO-11: the summary shows the cart as it is now, with why.
        takeCart(r.cart, r.notices ?? [r.message])
      } else {
        setFailure(r.message)
      }
    } catch {
      setFailure(NETWORK)
    }
    setPlacing(false)
  }

  const transfer = method === 'transfer' && cart.transferTotalCents != null
  const goods = transfer ? cart.transferTotalCents! : cart.totalCents
  const shippingCents = reached >= 2 && option ? option.priceCents : null
  const totals = {
    subtotalCents: cart.subtotalCents,
    discountCents: cart.subtotalCents - goods,
    shippingCents,
    shippingFree: option?.free,
    totalCents: goods + (shippingCents ?? 0),
    transferTotalCents: !transfer && cart.transferTotalCents != null ? cart.transferTotalCents + (shippingCents ?? 0) : null,
  }

  return (
    <div className="container-page pb-16 pt-6 md:pt-10" ref={top}>
      <h1 className="sr-only">Finalizar compra</h1>
      <Steps step={step} reached={reached} onGo={(n) => n < step && go(n)} />

      {/* CK-14 on phones: folded, with the total in view. */}
      <details className={`group mt-6 bg-shell lg:hidden ${leafPanel}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
          <span>Ver resumen ({formatARS(totals.totalCents)})</span>
          <span className="grid size-8 place-items-center rounded-full bg-paper">
            <ChevronDown size={18} className="chevron" />
          </span>
        </summary>
        <div className="px-5 pb-5">
          <Summary cart={cart} totals={totals} />
        </div>
      </details>

      <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="min-w-0 space-y-5">
          <Notices items={notices} />
          {failure && <Notices tone="error" items={[failure]} />}

          {step === 1 && (
            <Panel title="Tus datos" icon={<User />}>
              <Step1 contact={contact} setContact={setContact} err={err} touch={touch} signedIn={signedIn} />
              <NextButton onClick={continue1}>Continuar</NextButton>
            </Panel>
          )}

          {step === 2 && (
            <Panel title="Envío" icon={<Truck />}>
              <ShippingStep quote={quote} quoting={quoting} chosen={shippingKey} onChoose={setShippingKey} onEdit={() => go(1)} />
              <NextButton onClick={continue2} disabled={!option}>
                Continuar
              </NextButton>
            </Panel>
          )}

          {step === 3 && (
            <Panel title="Pago" icon={<Card />}>
              <PaymentStep methods={methods} method={method} onChoose={setMethod} transferPct={transferPct} transferHours={transferHours} contact={contact} setContact={setContact} err={err} touch={touch} />
              <NextButton onClick={continue3} disabled={!method}>
                Continuar
              </NextButton>
            </Panel>
          )}

          {step === 4 && option && method && (
            <Panel title="Revisá tu compra" icon={<Check />}>
              <Review contact={contact} option={option} method={method} cart={cart} onEdit={go} />
              <div className="mt-8 border-t border-line pt-6">
                <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => {
                      setTerms(e.target.checked)
                      if (e.target.checked) setTermsError(null)
                    }}
                    aria-invalid={!!termsError || undefined}
                    aria-describedby={termsError ? 'ck-terms-error' : undefined}
                    className="mt-1"
                  />
                  <span>
                    Leí y acepto los{' '}
                    <a href="/legales/terminos" target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
                      Términos y condiciones
                    </a>{' '}
                    y la{' '}
                    <a href="/legales/privacidad" target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
                      Política de privacidad
                    </a>
                    .
                  </span>
                </label>
                {termsError && (
                  <p id="ck-terms-error" className={`mt-2 ${errorText}`} role="alert">
                    {termsError}
                  </p>
                )}
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button type="button" onClick={place} disabled={placing || !cart.lines.length} className={buttonClasses('primary', 'lg', 'w-full sm:w-auto sm:min-w-64')}>
                    {placing ? 'Confirmando…' : 'Confirmar compra'}
                    {!placing && <ArrowRight size={20} />}
                  </button>
                  {method === 'mercadopago' && (
                    <p className="flex items-start gap-2.5 text-sm leading-snug text-ink-soft sm:max-w-xs">
                      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-sage-ink" />
                      <span>El pago lo procesa Mercado Pago. {brandName} no guarda los datos de tu tarjeta.</span>
                    </p>
                  )}
                </div>
                {method === 'mercadopago' && <p className="mt-3 text-sm text-ink-muted">Te llevamos a Mercado Pago para pagar.</p>}
                {!cart.lines.length && (
                  <Link href="/carrito" className="mt-4 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
                    <ArrowLeft size={18} />
                    Volver al carrito
                  </Link>
                )}
              </div>
            </Panel>
          )}
        </div>

        <aside className="hidden h-fit lg:sticky lg:top-8 lg:block" aria-labelledby="ck-resumen">
          <div className={`tex-linen bg-shell p-7 shadow-[var(--shadow-soft)] ${leafPanel}`}>
            <h2 id="ck-resumen" className="font-display text-display-sm">
              Resumen de tu compra
            </h2>
            <div className="mt-5">
              <Summary cart={cart} totals={totals} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Steps({ step, reached, onGo }: { step: number; reached: number; onGo: (n: number) => void }) {
  return (
    <nav aria-label="Pasos de la compra">
      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const current = n === step
          const can = done && n <= reached
          const content = (
            <>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors sm:size-10 ${
                  current ? 'bg-ink text-paper shadow-[0_10px_20px_-10px_rgb(40_30_20/0.6)]' : done ? 'bg-sage-soft text-sage-ink' : 'bg-paper text-ink-muted ring-1 ring-line-strong'
                }`}
              >
                {done ? <Check size={18} /> : n}
              </span>
              <span className={`text-center text-[0.8125rem] font-semibold leading-tight sm:text-left sm:text-[0.9375rem] ${current ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
            </>
          )
          return (
            <li key={label} className="relative">
              {can ? (
                <button type="button" onClick={() => onGo(n)} className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 hover:bg-shell sm:flex-row sm:gap-3">
                  {content}
                  <span className="sr-only"> (volver a este paso)</span>
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1.5 p-1 sm:flex-row sm:gap-3" aria-current={current ? 'step' : undefined}>
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className={`animate-rise bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8 ${leafPanel}`} aria-labelledby="ck-step-title">
      <div className="flex items-center gap-4">
        <IconBadge size="md">{icon}</IconBadge>
        <h2 id="ck-step-title" className="font-display text-display-sm" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function NextButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={buttonClasses('primary', 'lg', 'mt-8 w-full sm:w-auto sm:min-w-56')}>
      {children}
      <ArrowRight size={20} />
    </button>
  )
}

type FieldProps = {
  name: keyof CheckoutContact
  label: string
  contact: CheckoutContact
  setContact: React.Dispatch<React.SetStateAction<CheckoutContact>>
  err: (k: keyof CheckoutContact) => string | undefined
  touch: (k: (keyof CheckoutContact)[]) => void
  help?: ReactNode
  optional?: boolean
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  className?: string
  textarea?: boolean
  onValue?: (v: string) => void
}

function Field({ name, label, contact, setContact, err, touch, help, optional, type = 'text', autoComplete, inputMode, maxLength = 120, className = '', textarea, onValue }: FieldProps) {
  const id = `ck-${name}`
  const error = err(name)
  const describedBy = [error ? `${id}-error` : null, help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    name,
    value: String(contact[name] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value
      setContact((c) => ({ ...c, [name]: v }))
      onValue?.(v)
    },
    onBlur: () => touch([name]),
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
    maxLength,
  }
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-semibold">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
      </label>
      {textarea ? <textarea {...common} rows={3} className={`${fieldClass} h-auto py-3 leading-relaxed`} /> : <input {...common} type={type} autoComplete={autoComplete} inputMode={inputMode} className={fieldClass} />}
      {error && (
        <p id={`${id}-error`} className={`mt-1.5 ${errorText}`}>
          {error}
        </p>
      )}
      {help && (
        <p id={`${id}-help`} className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {help}
        </p>
      )}
    </div>
  )
}

function Step1({ contact, setContact, err, touch, signedIn }: Pick<FieldProps, 'contact' | 'setContact' | 'err' | 'touch'> & { signedIn: boolean }) {
  const f = { contact, setContact, err, touch }
  const provinceLabel = useId()
  return (
    <div className="space-y-9">
      {/* CK-03 */}
      <fieldset className="space-y-4">
        <legend className="mb-4 text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Contacto</legend>
        <Field {...f} name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
        {!signedIn && (
          <p className="text-[0.9375rem] text-ink-soft">
            ¿Ya tenés cuenta?{' '}
            <Link href="/cuenta/ingresar" className="font-semibold text-ink underline underline-offset-4">
              Ingresá
            </Link>
          </p>
        )}
        <label className="flex cursor-pointer items-center gap-3 text-[0.9375rem]">
          <input type="checkbox" checked={contact.newsletter} onChange={(e) => setContact((c) => ({ ...c, newsletter: e.target.checked }))} />
          Quiero recibir el newsletter
        </label>
      </fieldset>

      {/* CK-04, in its order. */}
      <fieldset>
        <legend className="mb-4 text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Datos de envío</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field {...f} name="firstName" label="Nombre" autoComplete="given-name" maxLength={60} />
          <Field {...f} name="lastName" label="Apellido" autoComplete="family-name" maxLength={60} />
          <Field
            {...f}
            name="dni"
            label="DNI"
            inputMode="numeric"
            maxLength={12}
            help={
              <>
                Lo pedimos para la factura y el envío. Tus datos quedan resguardados y no los compartimos con nadie más que el correo.{' '}
                <a href="/legales/privacidad" target="_blank" rel="noopener" className="font-semibold text-ink-soft underline underline-offset-4">
                  Ver Política de privacidad
                </a>
                .
              </>
            }
          />
          <Field {...f} name="phone" label="Teléfono (para coordinar la entrega)" type="tel" autoComplete="tel" inputMode="tel" maxLength={25} />
          <Field {...f} name="street" label="Calle y número" autoComplete="address-line1" className="sm:col-span-2" />
          <Field {...f} name="unit" label="Piso y depto" optional autoComplete="address-line2" maxLength={40} />
          <Field
            {...f}
            name="postcode"
            label="Código postal"
            autoComplete="postal-code"
            maxLength={12}
            onValue={(v) => {
              // A CPA names its province: fill it in when it was empty.
              const only = provincesForPostcode(v)
              if (only.length === 1) setContact((c) => (c.province ? c : { ...c, province: only[0]! }))
            }}
          />
          <Field {...f} name="locality" label="Localidad" autoComplete="address-level2" maxLength={80} />
          <div>
            <p id={provinceLabel} className="mb-1.5 block text-[0.9375rem] font-semibold">
              Provincia
            </p>
            <Select
              id="ck-province"
              labelledBy={provinceLabel}
              options={PROVINCE_OPTIONS}
              value={contact.province}
              placeholder="Elegí la provincia"
              onChange={(v) => {
                setContact((c) => ({ ...c, province: v }))
                touch(['province'])
              }}
              invalid={!!err('province')}
              describedBy={err('province') ? 'ck-province-error' : undefined}
            />
            {err('province') && (
              <p id="ck-province-error" className={`mt-1.5 ${errorText}`}>
                {err('province')}
              </p>
            )}
          </div>
          <Field {...f} name="notes" label="Indicaciones para la entrega" optional textarea maxLength={300} className="sm:col-span-2" />
        </div>
      </fieldset>
    </div>
  )
}

function OptionCard({ checked, onSelect, name, icon, title, children, aside }: { checked: boolean; onSelect: () => void; name: string; icon: ReactNode; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer gap-4 rounded-[1.25rem_2rem_1.25rem_2rem] border-2 p-4 transition-[border-color,background-color,box-shadow] sm:p-5 ${checked ? 'border-ink bg-shell shadow-[var(--shadow-soft)]' : 'border-line hover:border-line-strong'}`}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-1" />
      <IconBadge size="sm" tone={checked ? 'ink' : 'paper'}>
        {icon}
      </IconBadge>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{title}</span>
        {children && <span className="mt-1 block text-[0.9375rem] leading-relaxed text-ink-soft">{children}</span>}
      </span>
      {aside && <span className="shrink-0 text-right font-semibold tabular">{aside}</span>}
    </label>
  )
}

function ShippingStep({ quote, quoting, chosen, onChoose, onEdit }: { quote: Quote; quoting: boolean; chosen: string | null; onChoose: (k: string) => void; onEdit: () => void }) {
  if (quoting && !quote) return <p className="text-ink-muted">…</p>
  if (!quote) return null
  if (!quote.ok) {
    return (
      <div className="space-y-3">
        <p className={errorText} role="alert">
          {quote.error === 'postcode' ? CHECKOUT_ERRORS.postcode : NO_RATES}
        </p>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 font-semibold underline underline-offset-4">
          <Pencil size={18} />
          Editar
        </button>
      </div>
    )
  }
  // CK-06: home delivery only (D-03).
  return (
    <fieldset className="space-y-3" aria-busy={quoting}>
      <legend className="sr-only">Envío a domicilio</legend>
      {quote.options.map((o) => (
        <OptionCard
          key={o.key}
          name="ck-shipping"
          checked={chosen === o.key}
          onSelect={() => onChoose(o.key)}
          icon={<Truck />}
          title="Envío a domicilio"
          aside={
            o.free ? (
              <>
                <s className="block text-sm font-normal text-ink-muted">{formatARS(o.originalPriceCents)}</s>
                Gratis
              </>
            ) : (
              formatARS(o.priceCents)
            )
          }
        >
          {deliveryLine(o)}
        </OptionCard>
      ))}
    </fieldset>
  )
}

function PaymentStep({
  methods,
  method,
  onChoose,
  transferPct,
  transferHours,
  ...f
}: Pick<FieldProps, 'contact' | 'setContact' | 'err' | 'touch'> & { methods: PaymentChoice[]; method: PaymentChoice | null; onChoose: (m: PaymentChoice) => void; transferPct: number; transferHours: number }) {
  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="sr-only">Medio de pago</legend>
        {methods.includes('mercadopago') && (
          <OptionCard name="ck-method" checked={method === 'mercadopago'} onSelect={() => onChoose('mercadopago')} icon={<Card />} title="Mercado Pago">
            Tarjeta de crédito, débito o dinero en cuenta. Las cuotas dependen de tu banco y se eligen en Mercado Pago.
          </OptionCard>
        )}
        {methods.includes('transfer') && (
          <OptionCard name="ck-method" checked={method === 'transfer'} onSelect={() => onChoose('transfer')} icon={<Bank />} title="Transferencia bancaria">
            {transferPct > 0 && `${transferPct}% de descuento extra. `}Al confirmar te mostramos los datos. Tenés {transferHours} horas para transferir; si no, el pedido se cancela y los productos vuelven a estar disponibles.
          </OptionCard>
        )}
      </fieldset>

      {/* CK-10 */}
      <div className="rounded-[1.25rem_2rem_1.25rem_2rem] bg-shell p-5">
        <label className="flex cursor-pointer items-center gap-3 font-semibold">
          <input type="checkbox" checked={f.contact.wantsInvoiceA} onChange={(e) => f.setContact((c) => ({ ...c, wantsInvoiceA: e.target.checked }))} />
          ¿Necesitás factura A?
        </label>
        {f.contact.wantsInvoiceA && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field {...f} name="cuit" label="CUIT" inputMode="numeric" maxLength={13} />
            <Field {...f} name="businessName" label="Razón social" autoComplete="organization" />
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewBlock({ title, icon, onEdit, editHref, children }: { title: string; icon: ReactNode; onEdit?: () => void; editHref?: string; children: ReactNode }) {
  const edit = (
    <>
      <Pencil size={16} />
      Editar
    </>
  )
  return (
    <div className="flex gap-4 border-b border-line py-5 first:pt-0 last:border-b-0">
      <IconBadge size="sm" tone="paper">
        {icon}
      </IconBadge>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{title}</h3>
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft underline-offset-4 hover:bg-shell hover:text-ink" aria-label={`Editar ${title.toLowerCase()}`}>
              {edit}
            </button>
          )}
          {editHref && (
            <Link href={editHref} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-shell hover:text-ink" aria-label={`Editar ${title.toLowerCase()}`}>
              {edit}
            </Link>
          )}
        </div>
        <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  )
}

function Review({ contact: c, option, method, cart, onEdit }: { contact: CheckoutContact; option: NonNullable<Extract<PublicQuote, { ok: true }>['options'][number]>; method: PaymentChoice; cart: ShopCart; onEdit: (n: number) => void }) {
  const province = isProvince(c.province) ? PROVINCES[c.province] : c.province
  const cuit = normalizeCuit(c.cuit)
  return (
    <div>
      <ReviewBlock title="Datos" icon={<User />} onEdit={() => onEdit(1)}>
        <p className="font-medium text-ink">
          {c.firstName} {c.lastName}
        </p>
        <p>
          {c.email} · DNI {c.dni} · {c.phone}
        </p>
        <p>
          {c.street}
          {c.unit && `, ${c.unit}`} · {c.postcode} {c.locality}, {province}
        </p>
        {c.notes && <p className="italic">{c.notes}</p>}
      </ReviewBlock>
      <ReviewBlock title="Envío" icon={<Truck />} onEdit={() => onEdit(2)}>
        <p>
          Envío a domicilio · {deliveryLine(option)} · <span className="font-semibold text-ink">{option.free || option.priceCents === 0 ? 'Gratis' : formatARS(option.priceCents)}</span>
        </p>
      </ReviewBlock>
      <ReviewBlock title="Pago" icon={method === 'transfer' ? <Bank /> : <Card />} onEdit={() => onEdit(3)}>
        <p>{method === 'transfer' ? 'Transferencia bancaria' : 'Mercado Pago'}</p>
        {c.wantsInvoiceA && (
          <p>
            Factura A · CUIT {cuit ? formatCuit(cuit) : c.cuit} · {c.businessName}
          </p>
        )}
      </ReviewBlock>
      <ReviewBlock title="Productos" icon={<Box />} editHref="/carrito">
        <ul className="space-y-1">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>
                {l.quantity} × {l.name} · {l.sizeLabel}
              </span>
              <span className="tabular">{formatARS(l.unitChargedCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
      </ReviewBlock>
    </div>
  )
}

function Summary({ cart, totals }: { cart: ShopCart; totals: React.ComponentProps<typeof Totals>['t'] }) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{productos(cart.count)}</p>
      <ul className="mt-3 space-y-3">
        {cart.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span className="relative w-14 shrink-0">
              <span className="shape-arch block overflow-hidden">
                <ProductImage image={l.image} alt="" step={stepOf(l.stepLabel)} sizes="3.5rem" />
              </span>
              <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-paper tabular">{l.quantity}</span>
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug">
              <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{l.brand}</span>
              <span className="line-clamp-2 font-medium">{l.name}</span>
              <span className="text-ink-muted">{l.sizeLabel}</span>
            </span>
            <span className="text-sm font-semibold tabular">{formatARS(l.unitChargedCents * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-line pt-5">
        <Totals t={totals} />
      </div>
    </div>
  )
}
