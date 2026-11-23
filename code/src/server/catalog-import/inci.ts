// INCI lists: splitting the text from the pack and matching each name to an
// ingredient (CAT-19). Names are matched on a normalized key, and on their
// usual alternative spellings: "Water/Aqua", "Aqua (Water)", "Water (Aqua)".

/**
 * Splits an INCI list on commas outside parentheses, so "Parfum (Fragrance)"
 * stays whole. A comma between two digits is part of a chemical name
 * ("1,2-Hexanediol"), not a separator. Empty items are dropped and a trailing
 * period is removed.
 */
export function splitInci(text: string): string[] {
  const items: string[] = []
  let depth = 0
  let current = ''
  const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '(' || ch === '[') depth++
    else if ((ch === ')' || ch === ']') && depth > 0) depth--
    const inName = ch === ',' && isDigit(text[i - 1]) && isDigit(text[i + 1])
    if ((ch === ',' || ch === ';') && depth === 0 && !inName) {
      items.push(current)
      current = ''
    } else current += ch
  }
  items.push(current)
  return items.map((s) => s.replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim()).filter(Boolean)
}

/** Normalized key of an INCI name: lowercase, no accents, single spaces. */
export function inciKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim()
}

/**
 * The keys a name may match, most specific first: the whole name, then the
 * name without its parenthesis, the parenthesis alone, and each side of a
 * slash.
 */
export function inciCandidates(name: string): string[] {
  const keys = [inciKey(name)]
  const paren = name.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (paren) keys.push(inciKey(paren[1] ?? ''), inciKey(paren[2] ?? ''))
  for (const k of [...keys]) if (k.includes('/')) keys.push(...k.split('/').map((s) => s.trim()))
  return [...new Set(keys.filter(Boolean))]
}

/** A code for an ingredient created from an INCI name: lowercase, digits and hyphens. */
export function codeFromInci(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'ingrediente'
  )
}
