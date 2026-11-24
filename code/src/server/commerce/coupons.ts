// CMP-08: percent or amount, validity, minimum, uses, first purchase (by
// email or DNI, DIA-10) and whether it combines with the transfer discount.
// The cart checks what it can without the customer's data; placing the order
// checks everything again, inside the order's transaction.
import type { Coupon, Prisma, PrismaClient } from '@prisma/client'
import { formatARS } from '@/lib/money'
import type { CodeDiscount } from '@/lib/commerce/pricing'
import type { SettingValues } from '@/server/settings'
import { ambassadorDiscount, approvedByCode } from '@/server/ambassadors/program'

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

export type CodeCheck =
  | { ok: true; kind: 'coupon'; coupon: Coupon; ambassador: null; discount: CodeDiscount }
  | { ok: true; kind: 'ambassador'; coupon: null; ambassador: { id: string; code: string; firstName: string }; discount: CodeDiscount | null }
  | { ok: false; error: string }

/**
 * BO-06: the one code field takes a discount code or an ambassador's code.
 * Her code gives the customer her discount (EB-C07, possibly none) and always
 * records her commission (BO-07).
 */
export async function checkCode(db: Db, rawCode: string, ctx: { subtotalCents: number; email?: string | null; dni?: string | null; now?: Date }, settings: SettingValues): Promise<CodeCheck> {
  const code = normalizeCode(rawCode)
  if (await db.coupon.count({ where: { code } })) {
    const c = await checkCoupon(db, code, ctx)
    return c.ok ? { ok: true, kind: 'coupon', coupon: c.coupon, ambassador: null, discount: c.discount } : c
  }
  const a = await approvedByCode(db, code)
  if (a) return { ok: true, kind: 'ambassador', coupon: null, ambassador: { id: a.id, code: a.code!, firstName: a.firstName }, discount: ambassadorDiscount(a, settings) }
  return { ok: false, error: COUPON_ERRORS.unknown }
}
