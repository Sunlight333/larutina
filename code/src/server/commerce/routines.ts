// Routines in the cart (RUT-02..RUT-04, BO-03, BO-04). "Sumar la rutina"
// adds every step in one action, as one routine group; the cart then checks
// which part of the routine it still holds and applies the routine's discount
// to those lines, through the cascade (routine or code, the larger).
import { randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { productsInScope, routineScope, type RoutineScope, type RoutineShape } from '@/lib/commerce/routine'
import { variantAvailable } from '@/server/services/catalog/rules'
import { addToCart } from './cart'

type Db = PrismaClient | Prisma.TransactionClient

export const groupKey = (routineCode: string) => `${routineCode}~${randomBytes(4).toString('hex')}`
export const routineOfGroup = (group: string) => group.split('~')[0]!

const routineInclude = { steps: { orderBy: { position: 'asc' }, include: { alternatives: { orderBy: { position: 'asc' } } } } } satisfies Prisma.RoutineInclude

export async function loadRoutineShapes(db: Db, codes: string[]) {
  if (!codes.length) return new Map<string, { name: string; discountPct: number; shape: RoutineShape }>()
  const rows = await db.routine.findMany({ where: { code: { in: codes }, status: 'PUBLISHED', deletedAt: null }, include: routineInclude })
  return new Map(
    rows.map((r) => [
      r.code,
      {
        name: r.name,
        discountPct: r.discountPct ?? 0,
        shape: { discountHalves: r.discountHalves, steps: r.steps.map((s) => ({ id: s.id, moment: s.moment, optional: s.optional, productIds: [s.mainProductId, ...s.alternatives.map((a) => a.productId)] })) },
      },
    ]),
  )
}

export type CartRoutine = { group: string; code: string; name: string; scope: RoutineScope | null; discountPct: number; lineIds: string[] }

/**
 * For each routine group in the cart: which scope is complete, and which
 * lines earn the discount. Lines of a group whose routine is no longer
 * complete keep their group (shown together) but earn nothing.
 */
export async function cartRoutines(db: Db, lines: { id: string; productId: string; routineGroup: string | null }[]): Promise<CartRoutine[]> {
  const groups = [...new Set(lines.map((l) => l.routineGroup).filter((g): g is string => !!g))]
  const shapes = await loadRoutineShapes(db, [...new Set(groups.map(routineOfGroup))])
  return groups.map((group) => {
    const code = routineOfGroup(group)
    const r = shapes.get(code)
    const mine = lines.filter((l) => l.routineGroup === group)
    if (!r) return { group, code, name: code, scope: null, discountPct: 0, lineIds: [] }
    const scope = routineScope(r.shape, new Set(mine.map((l) => l.productId)))
    const eligible = scope ? productsInScope(r.shape, scope) : new Set<string>()
    return { group, code, name: r.name, scope, discountPct: scope ? r.discountPct : 0, lineIds: mine.filter((l) => eligible.has(l.productId)).map((l) => l.id) }
  })
}

export type AddRoutineInput = {
  code: string
  scope: RoutineScope
  /** Optional steps left out (RU-05). */
  skip?: string[]
  /** "Cambiar por otro": step id → alternative product id (RU-06). */
  swaps?: Record<string, string>
}

/** RUT-03: every step of the routine (or of its half) in one action, as one group. Returns what could not be added. */
export async function addRoutineToCart(db: PrismaClient, cartId: string, input: AddRoutineInput): Promise<{ added: number; group: string; unavailable: string[] } | null> {
  const routine = await db.routine.findFirst({ where: { code: input.code, status: 'PUBLISHED', deletedAt: null }, include: routineInclude })
  if (!routine) return null
  const group = groupKey(routine.code)
  const unavailable: string[] = []
  let added = 0
  for (const step of routine.steps) {
    const inScope = input.scope === 'full' || step.moment === 'BOTH' || (input.scope === 'am' ? step.moment === 'AM' : step.moment === 'PM')
    if (!inScope || (step.optional && input.skip?.includes(step.id))) continue
    const swap = input.swaps?.[step.id]
    const productId = swap && step.alternatives.some((a) => a.productId === swap) ? swap : step.mainProductId
    const product = await db.product.findUnique({ where: { id: productId }, include: { variants: { orderBy: [{ isMain: 'desc' }, { priceCents: 'asc' }] } } })
    const variant = product?.variants.find((v) => variantAvailable(product.status, v.stock)) ?? null
    // The main product is out: the first alternative in stock takes its place (as the engine does, DIA-09).
    let chosen = variant ? { sku: variant.sku } : null
    if (!chosen && !swap) {
      for (const alt of step.alternatives) {
        const p = await db.product.findUnique({ where: { id: alt.productId }, include: { variants: { orderBy: [{ isMain: 'desc' }, { priceCents: 'asc' }] } } })
        const v = p?.variants.find((x) => variantAvailable(p.status, x.stock))
        if (v) {
          chosen = { sku: v.sku }
          break
        }
      }
    }
    if (!chosen) {
      unavailable.push(product?.name ?? step.title)
      continue
    }
    const ok = await addToCart(db, cartId, { sku: chosen.sku, quantity: 1, source: 'ROUTINE', sourceRef: routine.code, routineGroup: group })
    if (ok) added++
    else unavailable.push(product?.name ?? step.title)
  }
  return { added, group, unavailable }
}
