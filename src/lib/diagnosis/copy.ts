// Display copy the engine and the result page share. Kept apart from the rules
// so wording can change without touching scoring.

export const SKIN_TYPE: Record<string, { name: string; summary: string }> = {
  seca: {
    name: 'Seca',
    summary: 'Produce poco sebo, por eso se siente tirante y a veces se descama. Necesita nutrición y una barrera fuerte.',
  },
  grasa: {
    name: 'Grasa',
    summary: 'Produce más sebo del que necesita: brilla, marca los poros y tiende a los granitos. Necesita equilibrio, no productos agresivos.',
  },
  mixta: {
    name: 'Mixta',
    summary: 'Grasa en la zona T y normal o seca en las mejillas. El objetivo es controlar el brillo sin resecar el resto.',
  },
  normal: {
    name: 'Normal',
    summary: 'Equilibrada, sin brillo ni tirantez marcados. La idea es mantenerla y trabajar sobre lo que quieras mejorar.',
  },
  sensible: {
    name: 'Sensible',
    summary: 'Reacciona con facilidad: se enrojece, arde o pica. Lo primero es calmar y reforzar la barrera, con fórmulas cortas.',
  },
}

export const CONCERN: Record<string, { name: string; phrase: string; focus: string }> = {
  acne: {
    name: 'Acné y granitos',
    phrase: 'los granitos',
    focus: 'Limpiar el poro por dentro y regular el sebo, sin resecar.',
  },
  manchas: {
    name: 'Manchas y tono desparejo',
    phrase: 'las manchas',
    focus: 'Activos que aclaran de a poco y protección solar todos los días, que es lo que evita que vuelvan.',
  },
  deshidratacion: {
    name: 'Deshidratación',
    phrase: 'la hidratación',
    focus: 'Sumar agua con humectantes y sellarla para que no se evapore.',
  },
  sensibilidad: {
    name: 'Rojeces y sensibilidad',
    phrase: 'las rojeces',
    focus: 'Calmar, reforzar la barrera y dejar afuera los activos que suelen irritar.',
  },
  lineas: {
    name: 'Líneas finas',
    phrase: 'las líneas finas',
    focus: 'Estimular la renovación de noche y proteger de día.',
  },
  poros: {
    name: 'Poros y brillo',
    phrase: 'los poros',
    focus: 'Regular el sebo y mantener los poros limpios para que se vean más chicos.',
  },
}

export type StepType = 'CLEANSER' | 'TONER' | 'EXFOLIANT' | 'SERUM' | 'TREATMENT' | 'MOISTURIZER' | 'SUNSCREEN'

export const STEP: Record<StepType, { name: string; purpose: string; frequency?: string }> = {
  CLEANSER: { name: 'Limpieza', purpose: 'Limpia sin dejar la piel tirante.' },
  TONER: { name: 'Tónico', purpose: 'Prepara la piel para que el resto de la rutina funcione mejor.' },
  EXFOLIANT: { name: 'Exfoliación', purpose: 'Renueva la superficie para que la piel se vea más lisa y pareja.', frequency: '2 o 3 noches por semana' },
  SERUM: { name: 'Sérum', purpose: 'Concentra los activos de la rutina.' },
  TREATMENT: { name: 'Tratamiento', purpose: 'Es el paso de tratamiento de la rutina.' },
  MOISTURIZER: { name: 'Hidratación', purpose: 'Sella la hidratación y cuida la barrera de la piel.' },
  SUNSCREEN: { name: 'Protección solar', purpose: 'Protege del sol, que es lo que más mancha y envejece la piel.' },
}

// Ingredient-level frequency advice. In the real build this is a Rule effect.
export const INGREDIENT_FREQUENCY: Record<string, string> = {
  retinol: 'Empezá con 2 noches por semana y subí de a poco',
}

export const MOMENT_LABEL: Record<string, string> = {
  AM: 'De mañana',
  PM: 'De noche',
  BOTH: 'Mañana y noche',
}

/** Joins a list the Spanish way: "a", "a y b", "a, b y c". */
export function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

/** Lowercases the first letter only, so "Zinc PCA" becomes "zinc PCA". */
export function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
