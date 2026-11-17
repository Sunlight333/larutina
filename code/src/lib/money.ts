// Money is an integer number of centavos, always (spec §5.2). The demo only
// needs ARS and whole-peso prices, so formatting drops the decimals when there
// are none, the way Argentine shops show prices.

export function assertCents(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error(`Money must be an integer number of cents, got ${cents}`)
  return cents
}

const whole = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export function formatARS(cents: number): string {
  assertCents(cents)
  return cents % 100 === 0 ? whole.format(cents / 100) : exact.format(cents / 100)
}

export function sumCents(values: number[]): number {
  return values.reduce((total, v) => total + assertCents(v), 0)
}
