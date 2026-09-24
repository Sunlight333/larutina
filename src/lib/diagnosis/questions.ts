// Questionnaire v1. In the real build this lives in the Questionnaire /
// Question / QuestionOption tables (spec §4.6); the demo keeps it in code.
// Weights are keyed by attribute: skin:<slug>, concern:<slug>, flag:sensitive,
// pref:steps.

export const RULE_VERSION = 1

export type Weights = Record<string, number>

export type Option = {
  value: string
  label: string
  weights: Weights
}

export type Question = {
  key: string
  prompt: string
  help: string
  type: 'single' | 'multi'
  max?: number
  options: Option[]
}

export const questions: Question[] = [
  {
    key: 'skin_feel_midday',
    prompt: 'Al mediodía, tu piel se siente…',
    help: 'Pensá en un día cualquiera, unas horas después de lavarte la cara.',
    type: 'single',
    options: [
      { value: 'tight_flaky', label: 'Tirante, a veces con zonas que se descaman', weights: { 'skin:seca': 3 } },
      { value: 'shiny_all', label: 'Brillante en toda la cara', weights: { 'skin:grasa': 3 } },
      { value: 'shiny_tzone', label: 'Brillante en frente y nariz, normal en mejillas', weights: { 'skin:mixta': 3 } },
      { value: 'comfortable', label: 'Cómoda, sin brillo ni tirantez', weights: { 'skin:normal': 3 } },
    ],
  },
  {
    key: 'breakouts',
    prompt: '¿Cada cuánto te salen granitos?',
    help: 'Contá también los puntos negros y los granitos chicos.',
    type: 'single',
    options: [
      { value: 'rarely', label: 'Casi nunca', weights: {} },
      { value: 'monthly', label: 'Algunos por mes', weights: { 'concern:acne': 2 } },
      { value: 'often', label: 'Seguido, en varias zonas', weights: { 'concern:acne': 4, 'skin:grasa': 1 } },
    ],
  },
  {
    key: 'goals',
    prompt: '¿Qué te gustaría mejorar?',
    help: 'Lo que elijas pesa más a la hora de elegir cada producto.',
    type: 'multi',
    max: 2,
    options: [
      { value: 'manchas', label: 'Manchas o tono desparejo', weights: { 'concern:manchas': 3 } },
      { value: 'poros', label: 'Poros y brillo', weights: { 'concern:poros': 3 } },
      { value: 'deshidratacion', label: 'Falta de hidratación', weights: { 'concern:deshidratacion': 3 } },
      { value: 'lineas', label: 'Líneas finas', weights: { 'concern:lineas': 3 } },
      { value: 'sensibilidad', label: 'Rojeces', weights: { 'concern:sensibilidad': 3 } },
    ],
  },
  {
    key: 'reaction',
    prompt: 'Cuando probás un producto nuevo…',
    help: 'Con esto dejamos afuera los activos que te pueden irritar.',
    type: 'single',
    options: [
      { value: 'none', label: 'No me pasa nada', weights: {} },
      { value: 'sometimes_red', label: 'A veces se me enrojece un poco', weights: { 'flag:sensitive': 1, 'concern:sensibilidad': 1 } },
      { value: 'burns', label: 'Me arde o me pica seguido', weights: { 'flag:sensitive': 3, 'concern:sensibilidad': 3, 'skin:sensible': 2 } },
    ],
  },
  {
    key: 'after_wash',
    prompt: '¿Cómo sentís la piel después de lavarla?',
    help: 'Sin ponerte nada, a los pocos minutos.',
    type: 'single',
    options: [
      { value: 'tight', label: 'Tirante, necesito ponerme crema enseguida', weights: { 'skin:seca': 2, 'concern:deshidratacion': 2 } },
      { value: 'fine', label: 'Bien, sin sensación rara', weights: { 'skin:normal': 1 } },
      { value: 'shiny_soon', label: 'Al rato ya vuelve el brillo', weights: { 'skin:grasa': 2, 'concern:poros': 1 } },
    ],
  },
  {
    key: 'routine_size',
    prompt: '¿Cuántos pasos querés en tu rutina?',
    help: 'Tres pasos alcanzan para empezar. La rutina completa suma tratamiento.',
    type: 'single',
    options: [
      { value: 'basic', label: 'Lo justo, tres pasos', weights: { 'pref:steps': 3 } },
      { value: 'complete', label: 'Una rutina completa', weights: { 'pref:steps': 5 } },
    ],
  },
]
