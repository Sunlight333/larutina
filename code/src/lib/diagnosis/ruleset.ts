// The diagnosis as data (DIA-01, DIA-03): questions with their options, help
// and detail, caps and order; what each option says about the skin; the
// rules; and the texts of the result. A rule set is versioned: publishing a
// change creates a new version, and every diagnosis records the version it
// ran on, so an old one can be reproduced exactly.
//
// Version 1 is the content file's questionnaire (D-10..D-17) with the draft
// rules of the plan (03 §2 "Engine", R-02..R-10), until LaRutina's filled
// diagnosis template replaces it from the panel.

/**
 * What an option says, as signals:
 *   skin:<code>       towards a base skin type (catalog skin type codes)
 *   concern:<code>    towards a need (catalog need codes)
 *   sensitivity       towards sensitivity (low/medium/high by thresholds)
 *   steps:basic|complete
 *   exclude:<family>  leave out a family (session only, never stored)
 *   experience:never|sometimes|often
 */
export type Signals = Record<string, number>

export type RuleOption = { code: string; label: string; signals: Signals }

export type RuleQuestion = {
  key: string
  prompt: string
  help: string
  /** The "i" button (D-06). */
  detail: string
  type: 'single' | 'multi'
  /** Multi only: how many can be picked, and what is said at one more (D-12). */
  max?: number
  maxMessage?: string
  /** DIA-07: the answer is used for this result and never stored. */
  sessionOnly?: boolean
  options: RuleOption[]
}

export type Condition = { question: string; anyOf: string[] }

export type RuleTexts = {
  /** R-03..R-06, by base skin type code. */
  skin: Record<string, string>
  highSensitivity: string // R-07
  excluded: Record<string, string> // R-08, by family code
  firstActives: string // R-09
  referral: string // R-10
  fewProducts: string // R-23
  rampFrequency: string // R-14 second form
  alternateWith: string // R-14 first form, {producto}
  caution: string // R-15, {producto} {nota}
  outOfStock: string // R-17, {producto}
  noStock: string // DIA-09
  because: string // R-13, {necesidades}
}

export type RuleSet = {
  version: number
  questions: RuleQuestion[]
  rules: {
    /** Order that breaks a tie between skin types (the conservative first). */
    skinPriority: string[]
    /** Order that breaks a tie between needs (safety first). */
    concernPriority: string[]
    /** How many needs drive the routine, and the minimum signal to count. */
    concernsCap: number
    concernMin: number
    /** Sensitivity: medium from this score, high from this score (D-13). */
    sensitivityMedium: number
    sensitivityHigh: number
    /** Families any question may exclude (Familias.excluible_en_diagnostico). */
    excludableFamilies: string[]
    /** R-10: these answers together recommend seeing a dermatologist and keep the routine gentle. */
    referral: Condition[]
    /** CAT-06: priority breaks ties within this many points. */
    tieWindow: number
    /** DIA-06: ramp length for strong actives, in weeks. */
    rampWeeks: number
    /** R-16: alternatives per step. */
    alternatives: number
    /** DIA-11: fewer steps than this in a moment shows the few-products notice. */
    minStepsPerMoment: number
    /** R-22: curated routines never suggested as the similar one. */
    hiddenRoutines: string[]
  }
  texts: RuleTexts
}

const Q_AVOID = 'evitar_retinoides'

export const DEFAULT_RULESET: RuleSet = {
  version: 1,
  questions: [
    {
      key: 'piel_mediodia',
      prompt: 'Al mediodía, tu piel se siente…',
      help: 'Pensá en un día cualquiera, unas horas después de lavarte la cara.',
      detail: '',
      type: 'single',
      options: [
        { code: 'tirante', label: 'Tirante, a veces con zonas que se descaman', signals: { 'skin:seca': 3 } },
        { code: 'brillo_total', label: 'Brillante en toda la cara', signals: { 'skin:grasa': 3 } },
        { code: 'brillo_t', label: 'Brillante en frente y nariz, normal en mejillas', signals: { 'skin:mixta': 3 } },
        { code: 'comoda', label: 'Cómoda, sin brillo ni tirantez', signals: { 'skin:normal': 3 } },
      ],
    },
    {
      key: 'granitos',
      prompt: '¿Cada cuánto te salen granitos?',
      help: 'Contá también los puntos negros y los granitos chicos.',
      detail: '',
      type: 'single',
      options: [
        { code: 'casi_nunca', label: 'Casi nunca', signals: {} },
        { code: 'algunos', label: 'Algunos por mes', signals: { 'concern:acne': 2 } },
        { code: 'seguido', label: 'Seguido, en varias zonas', signals: { 'concern:acne': 4, 'skin:grasa': 1 } },
      ],
    },
    {
      key: 'mejorar',
      prompt: '¿Qué te gustaría mejorar?',
      help: 'Elegí hasta dos. Lo que elijas pesa más a la hora de elegir cada producto.',
      detail: '',
      type: 'multi',
      max: 2,
      maxMessage: 'Podés elegir hasta dos. Sacá una para sumar otra.',
      options: [
        { code: 'manchas', label: 'Manchas o tono desparejo', signals: { 'concern:manchas': 3 } },
        { code: 'poros', label: 'Poros y brillo', signals: { 'concern:poros-brillo': 3 } },
        { code: 'hidratacion', label: 'Falta de hidratación', signals: { 'concern:deshidratacion': 3 } },
        { code: 'lineas', label: 'Líneas finas', signals: { 'concern:lineas-firmeza': 3 } },
        { code: 'rojeces', label: 'Rojeces', signals: { 'concern:rojeces-sensibilidad': 3 } },
        { code: 'apagada', label: 'Piel apagada', signals: { 'concern:luminosidad': 3 } },
      ],
    },
    {
      key: 'reaccion',
      prompt: 'Cuando probás un producto nuevo…',
      help: 'Con esto dejamos afuera los activos que te pueden irritar.',
      detail: '',
      type: 'single',
      options: [
        { code: 'nada', label: 'No me pasa nada', signals: {} },
        { code: 'a_veces', label: 'A veces se me enrojece un poco', signals: { sensitivity: 1, 'concern:rojeces-sensibilidad': 1 } },
        { code: 'arde', label: 'Me arde o me pica seguido', signals: { sensitivity: 3, 'concern:rojeces-sensibilidad': 3 } },
      ],
    },
    {
      key: 'despues_lavar',
      prompt: '¿Cómo sentís la piel después de lavarla?',
      help: 'Sin ponerte nada, a los pocos minutos.',
      detail: '',
      type: 'single',
      options: [
        { code: 'tirante', label: 'Tirante, necesito ponerme crema enseguida', signals: { 'skin:seca': 2, 'concern:deshidratacion': 2 } },
        { code: 'bien', label: 'Bien, sin sensación rara', signals: { 'skin:normal': 1 } },
        { code: 'brillo', label: 'Al rato ya vuelve el brillo', signals: { 'skin:grasa': 2, 'concern:poros-brillo': 1 } },
      ],
    },
    {
      key: 'pasos',
      prompt: '¿Cuántos pasos querés en tu rutina?',
      help: 'Tres pasos alcanzan para empezar. La rutina completa suma tratamiento.',
      detail: '',
      type: 'single',
      options: [
        { code: 'basica', label: 'Lo justo, tres pasos', signals: { 'steps:basic': 1 } },
        { code: 'completa', label: 'Una rutina completa', signals: { 'steps:complete': 1 } },
      ],
    },
    {
      key: Q_AVOID,
      prompt: '¿Preferís evitar los retinoides?',
      help: 'Por ejemplo, si estás embarazada, en lactancia, buscando un embarazo o te lo indicó una médica. No hace falta que nos digas el motivo.',
      detail: '',
      type: 'single',
      sessionOnly: true,
      options: [
        { code: 'si', label: 'Sí, prefiero evitarlos', signals: { 'exclude:retinoide': 1 } },
        { code: 'no', label: 'No', signals: {} },
      ],
    },
    {
      key: 'experiencia',
      prompt: '¿Usaste antes retinol, retinal o ácidos exfoliantes?',
      help: 'Si nunca usaste activos fuertes, empezamos de a poco.',
      detail: '',
      type: 'single',
      options: [
        { code: 'nunca', label: 'Nunca', signals: { 'experience:never': 1 } },
        { code: 'alguna_vez', label: 'Alguna vez', signals: { 'experience:sometimes': 1 } },
        { code: 'seguido', label: 'Los uso seguido', signals: { 'experience:often': 1 } },
      ],
    },
  ],
  rules: {
    skinPriority: ['mixta', 'grasa', 'seca', 'normal'],
    concernPriority: ['rojeces-sensibilidad', 'acne', 'manchas', 'lineas-firmeza', 'deshidratacion', 'poros-brillo', 'luminosidad'],
    concernsCap: 2,
    concernMin: 2,
    sensitivityMedium: 1,
    sensitivityHigh: 3,
    excludableFamilies: ['retinoide'],
    referral: [
      { question: 'reaccion', anyOf: ['arde'] },
      { question: 'granitos', anyOf: ['seguido'] },
    ],
    tieWindow: 3,
    rampWeeks: 2,
    alternatives: 2,
    minStepsPerMoment: 3,
    hiddenRoutines: ['reset-granitos'],
  },
  texts: {
    skin: {
      seca: 'Tu piel produce poco sebo y pierde agua rápido. Por eso la rutina prioriza hidratar y cuidar la barrera.',
      grasa: 'Tu piel produce más sebo del que necesita. La rutina lo regula sin resecarla, porque una piel reseca brilla más.',
      mixta: 'Tu zona T brilla y las mejillas no. La rutina equilibra las dos zonas sin tratar toda la cara igual.',
      normal: 'Tu piel está en equilibrio. La rutina se enfoca en lo que querés mejorar y en protegerla.',
    },
    highSensitivity: 'Como tu piel reacciona seguido, dejamos afuera los activos que más irritan.',
    excluded: { retinoide: 'Dejamos afuera el retinal y el retinol, como pediste.' },
    firstActives: 'Como es tu primera vez con activos fuertes, algunos pasos van día por medio las primeras dos semanas.',
    referral: 'Por lo que contás, te conviene ver a una dermatóloga antes de sumar activos. Mientras tanto, esta rutina es suave y no suma irritantes.',
    fewProducts: 'Para tu piel encontramos pocos productos en nuestro catálogo. Preferimos no sumar de más. Si querés, te ayudamos por WhatsApp.',
    rampFrequency: 'Día por medio las primeras dos semanas',
    alternateWith: 'Noches alternas con {producto}',
    caution: 'Con precaución junto a {producto}: {nota}',
    outOfStock: '{producto} está sin stock por ahora. Te dejamos la mejor alternativa.',
    noStock: 'Sin stock por ahora',
    because: 'Lo elegimos por {necesidades}.',
  },
}

export const ANSWER_LIMIT = 20
