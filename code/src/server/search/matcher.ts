// Token matching with typo tolerance (NAV-06): one edit for words of 4 to 7
// letters, two from 8, none below 4 (short words collide too easily). A
// swapped pair of letters counts as one edit, the most common typo.

/** Optimal string alignment distance, giving up once it exceeds `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const n = a.length
  const m = b.length
  if (!n) return m
  if (!m) return n
  let prev2 = new Array<number>(m + 1).fill(0)
  let prev = Array.from({ length: m + 1 }, (_, j) => j)
  let cur = new Array<number>(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    ;[prev2, prev, cur] = [prev, cur, prev2]
  }
  return prev[m]!
}

export function allowedTypos(token: string): number {
  if (token.length >= 8) return 2
  if (token.length >= 4) return 1
  return 0
}

export const QUALITY = { exact: 1, prefix: 0.8, typo: 0.55 } as const

/**
 * How well a query token matches an indexed term: exactly, as the start of it
 * (autocomplete while typing), or within the typo allowance. 0 = no match.
 */
export function matchQuality(query: string, term: string, opts: { prefix?: boolean; typos?: boolean } = {}): number {
  if (query === term) return QUALITY.exact
  if ((opts.prefix ?? true) && query.length >= 2 && term.startsWith(query)) return QUALITY.prefix
  if (opts.typos ?? true) {
    const max = allowedTypos(query)
    if (max > 0 && editDistance(query, term, max) <= max) return QUALITY.typo
  }
  return 0
}
