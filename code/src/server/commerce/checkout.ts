// Placing an order (CMP-03, CMP-06, PED-02). Everything the customer saw is
// checked again on the server: her data, the cart, the code, the shipping
// quote and the payment method. Then, in one transaction: the order with its
// price snapshot and the versions of the terms she accepted, the stock taken,
// the code redeemed. The payment starts after: a Mercado Pago checkout, or
// the transfer instructions with a 6-hour reservation (CMP-05).
import type { PaymentMethod, PrismaClient } from '@prisma/client'
import { validateContact, type CheckoutContact, type FieldErrors } from '@/lib/commerce/checkout-form'
import { loadSettings, type SettingValues } from '@/server/settings'
import { enqueueEmail, siteUrl } from '@/server/email'
import { findCart, viewCart, type CartView } from './cart'
import { checkCoupon, normalizeCode } from './coupons'
import { bankDetails, dayLabel, hourLabel, moveOrder, orderDetail, orderPath, orderVars, transferConfigured, SYSTEM } from './orders'
import { paymentProvider, type PaymentProvider } from './payments'
import { quoteShipping, optionKey, type QuoteOption } from './shipping/quote'
import type { ShippingProvider } from './shipping/provider'
import { OutOfStockError, reserveStock } from './stock'

/** The legal documents accepted with every order (CK-12): their published versions at that moment. */
export const ACCEPTED_DOCUMENTS = ['terminos', 'privacidad', 'cambios-y-devoluciones'] as const

/** CK-03: the newsletter box at checkout, unticked by default. */
export const CHECKOUT_NEWSLETTER_CONSENT = 'Quiero recibir el newsletter'

export type PaymentChoice = 'mercadopago' | 'transfer'

/** Which ways to pay can be offered right now. */
export function availableMethods(s: SettingValues, provider: PaymentProvider | null): PaymentChoice[] {
  const active = s['commerce.paymentMethods']
  const out: PaymentChoice[] = []
  if (provider && active.includes('mercadopago')) out.push('mercadopago')
  if (active.includes('transferencia') && transferConfigured(s)) out.push('transfer')
  return out
}

export type PlaceInput = {
  cartToken: string | null
  customerId: string | null
  contact: CheckoutContact
  shippingKey: string
  method: PaymentChoice
  acceptedTerms: boolean
}

export type PlaceResult =
  | { ok: true; orderId: string; number: string; method: PaymentChoice; redirectUrl: string | null }
  | { ok: false; reason: 'fields'; errors: FieldErrors }
  | { ok: false; reason: 'terms' | 'empty' | 'method' | 'shipping' | 'payment-start'; message: string }
  | { ok: false; reason: 'coupon'; message: string }
  /** CK-18: someone else took the last units while she was buying. */
  | { ok: false; reason: 'stock'; message: string; products: string[] }
  /** BO-11: the cart changed when it was read again. */
  | { ok: false; reason: 'cart-changed'; message: string; notices: string[] }

const MESSAGES = {
  terms: 'Para seguir, aceptá los Términos y condiciones y la Política de privacidad.',
  empty: 'Tu carrito está vacío.',
  method: 'Elegí un medio de pago.',
  shipping: 'Elegí una opción de envío.',
  paymentStart: 'No pudimos conectar con Mercado Pago. Probá de nuevo en un momento.',
}

export async function placeOrder(
  db: PrismaClient,
  input: PlaceInput,
  deps: { payments?: PaymentProvider | null; shipping?: ShippingProvider | null; now?: Date } = {},
): Promise<PlaceResult> {
  const s = await loadSettings(db)
  const payments = deps.payments === undefined ? paymentProvider(db) : deps.payments
  const now = deps.now ?? new Date()

  const contact = validateContact(input.contact)
  if (!contact.ok) return { ok: false, reason: 'fields', errors: contact.errors }
  const c = contact.value
  if (!input.acceptedTerms) return { ok: false, reason: 'terms', message: MESSAGES.terms }
  if (!availableMethods(s, payments).includes(input.method)) return { ok: false, reason: 'method', message: MESSAGES.method }

  const cartRow = await findCart(db, input.cartToken)
  const transferPct = input.method === 'transfer' ? s['commerce.transferDiscountPct'] : 0
  const cart: CartView = await viewCart(db, cartRow, { transferPct, capPct: s['commerce.discountCapPct'], fix: true, email: c.email, dni: c.dni })
  if (!cartRow || !cart.lines.length) return { ok: false, reason: 'empty', message: MESSAGES.empty }
  if (cart.notices.length) return { ok: false, reason: 'cart-changed', message: cart.notices.join(' '), notices: cart.notices }
  if (cart.couponCode && cart.couponError) return { ok: false, reason: 'coupon', message: cart.couponError }

  const quote = await quoteShipping(
    db,
    { postcode: c.postcode, province: c.province, parcels: cart.lines.map((l) => l.parcel), goodsCents: cart.pricing.totalCents, freeFromCents: s['commerce.freeShippingFromCents'], maxOptions: s['commerce.shippingOptions'] },
    deps.shipping,
  )
  const option: QuoteOption | undefined = quote.ok ? quote.options.find((o) => optionKey(o) === input.shippingKey) : undefined
  if (!option) return { ok: false, reason: 'shipping', message: MESSAGES.shipping }

  const legal = await db.legalDocument.findMany({ where: { code: { in: [...ACCEPTED_DOCUMENTS] } }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
  const termsAccepted = ACCEPTED_DOCUMENTS.map((code) => ({ code, version: legal.find((d) => d.code === code)?.versions[0]?.version ?? null }))

  const reservationMs = input.method === 'transfer' ? s['commerce.transferReservationHours'] * 3_600_000 : s['commerce.cardReservationMinutes'] * 60_000
  const reservedUntil = new Date(now.getTime() + reservationMs)
  const totalCents = cart.pricing.totalCents + option.priceCents
  const lineDiscount = new Map(cart.pricing.lines.map((l) => [l.key, l]))
  const paymentMethod: PaymentMethod = input.method === 'transfer' ? 'TRANSFER' : 'MERCADOPAGO'

  let order
  try {
    order = await db.$transaction(async (tx) => {
      // A new attempt from the same cart replaces an unpaid card checkout, so stock is never held twice.
      const stale = await tx.order.findMany({ where: { cartId: cartRow.id, status: 'PENDING_PAYMENT', paymentMethod: 'MERCADOPAGO' }, select: { id: true } })
      for (const o of stale) await moveOrder(tx, o.id, 'CANCELLED', SYSTEM, { message: 'Reemplazado por un nuevo intento de compra', cancelReason: 'payment_expired', settings: s })

      // The code again, with the row locked so its uses cannot be overrun.
      let couponId: string | null = null
      if (cart.couponCode) {
        const row = await tx.coupon.findUnique({ where: { code: normalizeCode(cart.couponCode) }, select: { id: true } })
        if (row) await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${row.id} FOR UPDATE`
        const check = await checkCoupon(tx, cart.couponCode, { subtotalCents: cart.pricing.subtotalCents, email: c.email, dni: c.dni, now })
        if (!check.ok) throw new CouponRejected(check.error)
        couponId = check.coupon.id
      }

      const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`
      const number = `LR-${String(seq[0]!.n).padStart(6, '0')}`
      const created = await tx.order.create({
        data: {
          number,
          customerId: input.customerId,
          cartId: cartRow.id,
          paymentMethod,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          dni: c.dni,
          phone: c.phone,
          shippingAddress: { street: c.street, unit: c.unit || null, postcode: c.postcode, locality: c.locality, province: c.province, notes: c.notes || null },
          invoice: c.invoice ?? undefined,
          newsletterOptIn: c.newsletter,
          subtotalCents: cart.pricing.subtotalCents,
          routineDiscountCents: cart.pricing.routineDiscountCents,
          codeDiscountCents: cart.pricing.codeDiscountCents,
          transferDiscountCents: cart.pricing.transferDiscountCents,
          discountCents: cart.pricing.discountCents,
          shippingCents: option.priceCents,
          totalCents,
          couponCode: cart.couponCode ? normalizeCode(cart.couponCode) : null,
          ambassadorCode: cartRow.ambassadorCode,
          shipping: {
            provider: option.provider,
            carrier: option.carrier,
            service: option.service,
            ref: option.ref ?? null,
            minDays: option.minDays,
            maxDays: option.maxDays,
            priceCents: option.priceCents,
            originalPriceCents: option.originalPriceCents,
            free: option.free,
            fallback: option.fallback,
            boxCode: option.boxCode,
            weightGrams: option.weightGrams,
          },
          termsAccepted,
          reservedUntil,
          placedAt: now,
          items: {
            create: cart.lines.map((l) => {
              const priced = lineDiscount.get(l.id)!
              return {
                variantId: l.variantId,
                productId: l.productId,
                productCode: l.productCode,
                productName: l.name,
                brandName: l.brand,
                sku: l.sku,
                sizeLabel: l.sizeLabel,
                image: l.imageFile,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents,
                unitChargedCents: l.unitChargedCents,
                subtotalCents: priced.subtotalCents,
                discountCents: priced.discountCents,
                totalCents: priced.totalCents,
                unitCostCents: l.unitCostCents,
                source: l.source,
                sourceRef: l.sourceRef,
                routineGroup: l.routineGroup,
              }
            }),
          },
        },
        include: { items: true },
      })

      const statuses = new Map(cartRow.items.map((i) => [i.variantId, i.variant.product.status]))
      await reserveStock(tx, created.id, cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, status: statuses.get(l.variantId) ?? 'ACTIVE' })))
      if (couponId) await tx.couponRedemption.create({ data: { couponId, orderId: created.id, email: c.email, dni: c.dni } })
      await tx.orderEvent.create({ data: { orderId: created.id, type: 'status', toStatus: 'PENDING_PAYMENT', message: input.method === 'transfer' ? 'Pedido reservado: esperando la transferencia' : 'Pedido creado: esperando el pago', actorType: 'CUSTOMER', actorId: input.customerId, actorLabel: c.email } })
      await tx.cart.update({ where: { id: cartRow.id }, data: { email: c.email } })

      if (c.newsletter) {
        await tx.newsletterSubscriber.upsert({ where: { email: c.email }, create: { email: c.email, consentText: CHECKOUT_NEWSLETTER_CONSENT, source: 'checkout' }, update: { unsubscribedAt: null } })
      }

      if (paymentMethod === 'TRANSFER') {
        await tx.payment.create({ data: { orderId: created.id, provider: 'transfer', status: 'awaiting_transfer', amountCents: totalCents } })
        // The transfer customer is done with this cart.
        await tx.cartItem.deleteMany({ where: { cartId: cartRow.id } })
        await tx.cart.update({ where: { id: cartRow.id }, data: { couponCode: null, convertedAt: now } })
        await enqueueEmail(
          tx,
          {
            template: 'transfer_pending',
            to: c.email,
            vars: { ...orderVars(created), hora: hourLabel(reservedUntil), dia: dayLabel(reservedUntil), horas: s['commerce.transferReservationHours'], link_pedido: `${siteUrl(s)}${orderPath(created)}` },
            ctaPath: orderPath(created),
            blocks: { datos_bancarios: bankDetails(s), detalle: orderDetail(created) },
            dedupeKey: `order:${created.id}:transfer-pending`,
            related: { type: 'order', id: created.id },
          },
          s,
        )
      }
      return created
    })
  } catch (e) {
    if (e instanceof OutOfStockError) {
      const names = cart.lines.filter((l) => e.variantIds.includes(l.variantId)).map((l) => l.name)
      // CK-18, one sentence per product.
      return { ok: false, reason: 'stock', products: names, message: names.map((n) => `Mientras comprabas, ${n} se quedó sin stock. Lo sacamos y actualizamos el total.`).join(' ') }
    }
    if (e instanceof CouponRejected) return { ok: false, reason: 'coupon', message: e.message }
    throw e
  }

  if (paymentMethod === 'TRANSFER') return { ok: true, orderId: order.id, number: order.number, method: 'transfer', redirectUrl: null }

  // Mercado Pago: the checkout is created outside the transaction (it is a network call).
  const base = siteUrl(s)
  const back = `${base}/checkout/resultado?pedido=${encodeURIComponent(order.number)}`
  try {
    const { preferenceId, redirectUrl } = await payments!.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      title: `${s['brand.fullName']} · Pedido #${order.number}`,
      totalCents,
      payer: { email: c.email, firstName: c.firstName, lastName: c.lastName, dni: c.dni, phone: c.phone },
      urls: { success: back, failure: back, pending: back, notification: `${base}/api/pagos/notificacion` },
      expiresAt: reservedUntil,
      maxInstallments: s['commerce.maxInstallments'],
      allowCash: s['commerce.cashVouchers'],
    })
    await db.payment.create({ data: { orderId: order.id, provider: payments!.name, preferenceId, status: 'created', amountCents: totalCents } })
    return { ok: true, orderId: order.id, number: order.number, method: 'mercadopago', redirectUrl }
  } catch (e) {
    console.error(`[checkout] order ${order.number}: could not start the payment:`, (e as Error).message)
    await db.$transaction((tx) => moveOrder(tx, order.id, 'CANCELLED', SYSTEM, { message: 'No se pudo iniciar el pago', cancelReason: 'payment_expired', settings: s }))
    return { ok: false, reason: 'payment-start', message: MESSAGES.paymentStart }
  }
}

class CouponRejected extends Error {}
