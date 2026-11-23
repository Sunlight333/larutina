// Text normalisation shared by the index and the queries: accents and case
// do not matter ("hialurónico" = "HIALURONICO"), and a light plural strip
// makes "manchas" find "mancha" and "cremas" find "crema".

/** Words that carry no meaning in a skincare search ("algo para la piel seca"). */
const STOPWORDS = new Set([
  'a', 'al', 'algo', 'con', 'de', 'del', 'el', 'en', 'es', 'la', 'las', 'lo', 'los', 'me', 'mi', 'mis', 'para', 'por', 'que', 'se', 'sin',
  'su', 'sus', 'tengo', 'un', 'una', 'uno', 'unos', 'unas', 'y', 'o', 'u', 'quiero', 'busco', 'necesito', 'piel', 'producto', 'productos',
  'the', 'and', 'of', 'for', 'with',
])

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
}

/**
 * Plural strip: "granitos" → "granito", "noches" → "noche". Only a final
 * "s", so the index and the query always reduce a word the same way;
 * "protectores" vs "protector" is left to prefix and typo matching.
 */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

/** Every token, stemmed, stopwords included (for indexing names as written). */
export function tokens(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9+]+/)
    .map((t) => t.replace(/^\++|\++$/g, ''))
    .filter(Boolean)
    .map(stem)
}

/** Query tokens: like tokens() but without stopwords, unless the query is only stopwords. */
export function queryTokens(text: string): string[] {
  const all = fold(text)
    .split(/[^a-z0-9+]+/)
    .map((t) => t.replace(/^\++|\++$/g, ''))
    .filter(Boolean)
  const meaningful = all.filter((t) => !STOPWORDS.has(t))
  return (meaningful.length ? meaningful : all).map(stem).slice(0, 12)
}

export const isStopword = (t: string) => STOPWORDS.has(t)
