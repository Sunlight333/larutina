import { describe, expect, it } from 'vitest'
import { allocate, priceCart, type PricingLine } from '@/lib/commerce/pricing'

const ARS = (pesos: number) => pesos * 100
const line = (key: string, pesos: number, quantity = 1, routineGroup?: string | null): PricingLine => ({ key, unitChargedCents: ARS(pesos), quantity, routineGroup })

describe('allocate', () => {
  it('splits in proportion and always adds up to the amount', () => {
    expect(allocate(ARS(10), [1, 1, 1])).toEqual([ARS(4), ARS(3), ARS(3)])
    expect(allocate(ARS(100), [ARS(300), ARS(100)])).toEqual([ARS(75), ARS(25)])
    expect(allocate(0, [1, 2])).toEqual([0, 0])
    expect(allocate(ARS(5), [0, 0])).toEqual([0, 0])
  })
})

describe('discount cascade (CMP-02)', () => {
  it('without discounts the total is the subtotal', () => {
    const p = priceCart({ lines: [line('a', 10000, 2), line('b', 5000)] })
    expect(p.subtotalCents).toBe(ARS(25000))
    expect(p.totalCents).toBe(ARS(25000))
    expect(p.applied).toBeNull()
  })

  it('applies the routine discount to the routine lines only', () => {
    const p = priceCart({ lines: [line('a', 10000, 1, 'r1'), line('b', 10000, 1, 'r1'), line('c', 10000)], routineGroups: { r1: 10 } })
    expect(p.routineDiscountCents).toBe(ARS(2000))
    expect(p.lines.find((l) => l.key === 'c')!.discountCents).toBe(0)
    expect(p.applied).toBe('routine')
  })

  it('routine or code: the larger applies, never both (BO-07)', () => {
    const lines = [line('a', 10000, 1, 'r1'), line('b', 10000, 1, 'r1')]
    const codeWins = priceCart({ lines, routineGroups: { r1: 10 }, code: { kind: 'PERCENT', value: 15, combinesWithTransfer: true } })
    expect(codeWins.applied).toBe('code')
    expect(codeWins.codeDiscountCents).toBe(ARS(3000))
    expect(codeWins.routineDiscountCents).toBe(0)

    const routineWins = priceCart({ lines, routineGroups: { r1: 10 }, code: { kind: 'PERCENT', value: 5, combinesWithTransfer: true } })
    expect(routineWins.applied).toBe('routine')
    expect(routineWins.discountCents).toBe(ARS(2000))
    expect(routineWins.codeOutdone).toBe(true)
  })

  it('transfer goes in cascade: 10% + 5% is 14,5%, not 15% (CK-08)', () => {
    const p = priceCart({ lines: [line('a', 10000, 1, 'r1')], routineGroups: { r1: 10 }, transferPct: 5 })
    expect(p.routineDiscountCents).toBe(ARS(1000))
    expect(p.transferDiscountCents).toBe(ARS(450))
    expect(p.totalCents).toBe(ARS(8550))
  })

  it('a code that does not combine with transfer drops the transfer discount', () => {
    const p = priceCart({ lines: [line('a', 10000)], code: { kind: 'PERCENT', value: 10, combinesWithTransfer: false }, transferPct: 5 })
    expect(p.transferDiscountCents).toBe(0)
    expect(p.totalCents).toBe(ARS(9000))
  })

  it('never goes over the cap: transfer gives way first, then the first discount', () => {
    const lines = [line('a', 10000, 1, 'r1')]
    const transferTrimmed = priceCart({ lines, routineGroups: { r1: 10 }, transferPct: 10, capPct: 15 })
    expect(transferTrimmed.discountCents).toBe(ARS(1500))
    expect(transferTrimmed.routineDiscountCents).toBe(ARS(1000))
    expect(transferTrimmed.transferDiscountCents).toBe(ARS(500))
    expect(transferTrimmed.capped).toBe(true)

    const firstTrimmed = priceCart({ lines, code: { kind: 'PERCENT', value: 30, combinesWithTransfer: true }, transferPct: 10, capPct: 20 })
    expect(firstTrimmed.discountCents).toBe(ARS(2000))
    expect(firstTrimmed.transferDiscountCents).toBe(0)
  })

  it('an amount code never takes the subtotal below zero', () => {
    const p = priceCart({ lines: [line('a', 3000)], code: { kind: 'AMOUNT', value: ARS(5000), combinesWithTransfer: true } })
    expect(p.totalCents).toBe(0)
  })

  it('discounts are whole pesos, rounded down', () => {
    const p = priceCart({ lines: [line('a', 12345)], transferPct: 5 })
    expect(p.transferDiscountCents).toBe(ARS(617))
    expect(p.totalCents % 100).toBe(0)
  })

  it('the lines always add up to the order, for any mix (commission base per line)', () => {
    let seed = 7
    const rnd = (n: number) => ((seed = (seed * 16807) % 2147483647), seed % n)
    for (let run = 0; run < 300; run++) {
      const lines = Array.from({ length: 1 + rnd(6) }, (_, i) => line(`l${i}`, 500 + rnd(40000), 1 + rnd(3), rnd(2) ? 'r1' : null))
      const capPct = rnd(2) ? 5 + rnd(30) : 0
      const p = priceCart({
        lines,
        routineGroups: rnd(2) ? { r1: rnd(30) } : {},
        code: rnd(2) ? { kind: rnd(2) ? 'PERCENT' : 'AMOUNT', value: rnd(2) ? rnd(40) : ARS(rnd(20000)), combinesWithTransfer: !!rnd(2) } : null,
        transferPct: rnd(15),
        capPct,
      })
      if (capPct) expect(p.discountCents).toBeLessThanOrEqual((p.subtotalCents * capPct) / 100)
      const sum = (k: 'subtotalCents' | 'discountCents' | 'totalCents') => p.lines.reduce((a, l) => a + l[k], 0)
      expect(sum('subtotalCents')).toBe(p.subtotalCents)
      expect(sum('discountCents')).toBe(p.discountCents)
      expect(sum('totalCents')).toBe(p.totalCents)
      expect(p.discountCents).toBe(p.routineDiscountCents + p.codeDiscountCents + p.transferDiscountCents)
      expect(p.lines.every((l) => l.discountCents >= 0 && l.totalCents >= 0)).toBe(true)
    }
  })
})
