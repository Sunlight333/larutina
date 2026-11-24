// Argentine address and identity checks for the checkout (CMP-03, CK-04,
// CK-05): postcode in either form, province coherent with the postcode,
// phone with area code, DNI and CUIT. Pure, so the browser and the server
// check the same way.

/** Provinces by their ISO 3166-2:AR letter, which is also the first letter of a CPA postcode. */
export const PROVINCES = {
  C: 'Ciudad Autónoma de Buenos Aires',
  B: 'Buenos Aires',
  K: 'Catamarca',
  H: 'Chaco',
  U: 'Chubut',
  X: 'Córdoba',
  W: 'Corrientes',
  E: 'Entre Ríos',
  P: 'Formosa',
  Y: 'Jujuy',
  L: 'La Pampa',
  F: 'La Rioja',
  M: 'Mendoza',
  N: 'Misiones',
  Q: 'Neuquén',
  R: 'Río Negro',
  A: 'Salta',
  J: 'San Juan',
  D: 'San Luis',
  Z: 'Santa Cruz',
  S: 'Santa Fe',
  G: 'Santiago del Estero',
  V: 'Tierra del Fuego',
  T: 'Tucumán',
} as const
export type ProvinceCode = keyof typeof PROVINCES

export const PROVINCE_OPTIONS = (Object.entries(PROVINCES) as [ProvinceCode, string][])
  .sort((a, b) => (a[0] === 'C' ? -1 : b[0] === 'C' ? 1 : a[1].localeCompare(b[1], 'es')))
  .map(([value, label]) => ({ value, label }))

export const isProvince = (code: string): code is ProvinceCode => code in PROVINCES

// The provinces each first digit of a four-digit postcode can belong to. The
// old numbering crosses provincial borders, so this only rules out the
// impossible (1425 in Mendoza), never a real address.
const BY_FIRST_DIGIT: Record<string, ProvinceCode[]> = {
  '1': ['C', 'B'],
  '2': ['B', 'S', 'E', 'X'],
  '3': ['S', 'E', 'W', 'H', 'N', 'P', 'G'],
  '4': ['T', 'A', 'Y', 'G', 'K'],
  '5': ['X', 'F', 'M', 'J', 'D', 'K', 'G', 'L'],
  '6': ['B', 'L', 'S', 'X'],
  '7': ['B'],
  '8': ['B', 'Q', 'R', 'L', 'U', 'M'],
  '9': ['U', 'Z', 'V'],
}

export type Postcode = { digits: string; cpa: string | null; province: ProvinceCode | null }

/** "1425", "C1425ABC" or "c1425abc" → its parts; null when it is neither form. */
export function parsePostcode(input: string): Postcode | null {
  const s = input.replace(/\s+/g, '').toUpperCase()
  const cpa = /^([A-HJ-NP-Z])(\d{4})([A-Z]{3})$/.exec(s)
  if (cpa) return { digits: cpa[2]!, cpa: s, province: isProvince(cpa[1]!) ? cpa[1] : null }
  if (/^\d{4}$/.test(s) && s[0] !== '0') return { digits: s, cpa: null, province: null }
  return null
}

/** Whether a postcode can be in a province: exact for CPA, by range otherwise. */
export function postcodeMatchesProvince(postcode: string, province: string): boolean {
  const p = parsePostcode(postcode)
  if (!p || !isProvince(province)) return false
  if (p.province) return p.province === province
  return (BY_FIRST_DIGIT[p.digits[0]!] ?? []).includes(province)
}

/**
 * A phone with area code, in any common writing: "+54 9 11 5039-0302",
 * "011 15 5039-0302", "(351) 456-7890". Returns the 10 national digits
 * (area code + number), or null.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.length === 12) {
    // A mobile written with "15" after an area code of 2 to 4 digits.
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') {
        const candidate = d.slice(0, area) + d.slice(area + 2)
        if (candidate.length === 10) return candidate
      }
    }
    return null
  }
  return d.length === 10 ? d : null
}

/** DNI: 7 or 8 digits, dots allowed. */
export function normalizeDni(input: string): string | null {
  const d = input.replace(/[.\s]/g, '')
  return /^\d{7,8}$/.test(d) && Number(d) > 999_999 ? d : null
}

/** CUIT/CUIL with its check digit: "30-71234567-1" or "30712345671". */
export function normalizeCuit(input: string): string | null {
  const d = input.replace(/[-.\s]/g, '')
  if (!/^\d{11}$/.test(d)) return null
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0)
  const mod = 11 - (sum % 11)
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod
  return check === Number(d[10]) ? d : null
}

export function formatCuit(cuit: string): string {
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

/** The provinces a postcode can belong to: one for a CPA, a few for four digits. */
export function provincesForPostcode(postcode: string): ProvinceCode[] {
  const p = parsePostcode(postcode)
  if (!p) return []
  if (p.province) return [p.province]
  return BY_FIRST_DIGIT[p.digits[0]!] ?? []
}
