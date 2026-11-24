// CMP-08: percent or amount, validity, minimum, uses, first purchase (by
// email or DNI, DIA-10) and whether it combines with the transfer discount.
// The cart checks what it can without the customer's data; placing the order
// checks everything again, inside the order's transaction.
import type { Coupon, Prisma, PrismaClient } from '@prisma/client'
import { formatARS } from '@/lib/money'
import type { CodeDiscount } from '@/lib/commerce/pricing'

type Db = PrismaClient | Prisma.TransactionClient

export const COUPON_ERRORS = {
  unknown: 'Ese código no existe o ya venció.', // BO-06
  used: 'Este código ya no tiene usos disponibles.',
  firstPurchase: 'Este código es solo para la primera compra.',
  minimum: (cents: number) => `Este código es para compras desde ${formatARS(cents)}.`,
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

export type CouponCheck = { ok: true; coupon: Coupon; discount: CodeDiscount } | { ok: false; error: string }

/** Statuses that count as a purchase for "first purchase" and for uses. */
const PURCHASED: Prisma.EnumOrderStatusFilter = { notIn: ['PENDING_PAYMENT', 'CANCELLED'] }

export async function checkCoupon(
  db: Db,
  rawCode: string,
  ctx: { subtotalCents: number; email?: string | null; dni?: string | null; now?: Date },
): Promise<CouponCheck> {
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false, error: COUPON_ERRORS.unknown }
  const coupon = await db.coupon.findUnique({ where: { code } })
  const now = ctx.now ?? new Date()
  if (!coupon || !coupon.active || coupon.deletedAt || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)) {
    return { ok: false, error: COUPON_ERRORS.unknown }
  }
  if (coupon.minSubtotalCents && ctx.subtotalCents < coupon.minSubtotalCents) return { ok: false, error: COUPON_ERRORS.minimum(coupon.minSubtotalCents) }
  if (coupon.maxUses != null) {
    // A pending order holds its use until it is paid or cancelled.
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, order: { status: { not: 'CANCELLED' } } } })
    if (used >= coupon.maxUses) return { ok: false, error: COUPON_ERRORS.used }
  }
  if (coupon.firstPurchaseOnly && (ctx.email || ctx.dni)) {
    const or: Prisma.OrderWhereInput[] = []
    if (ctx.email) or.push({ email: ctx.email.toLowerCase() })
    if (ctx.dni) or.push({ dni: ctx.dni })
    const previous = await db.order.count({ where: { OR: or, status: PURCHASED } })
    if (previous > 0) return { ok: false, error: COUPON_ERRORS.firstPurchase }
  }
  return { ok: true, coupon, discount: { kind: coupon.kind, value: coupon.value, combinesWithTransfer: coupon.combinesWithTransfer } }
}
