// Copy variables (GEN-06): texts edited in the panel may say {productos} or
// {envio_gratis_desde} and get the current value, so a count or a threshold
// never goes stale in the copy. Unknown variables are left as written, so a
// typo is visible rather than silently blank.

export type CopyVariables = Record<string, string | number>

export function fillVariables(text: string, vars: CopyVariables): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/** Variables available to every text, and what each one is. */
export const VARIABLE_HELP: Record<string, string> = {
  marca: 'Nombre de la marca',
  productos: 'Cantidad de productos publicados',
  marcas: 'Cantidad de marcas con productos publicados',
  rutinas: 'Cantidad de rutinas publicadas',
  preguntas: 'Cantidad de preguntas del diagnóstico',
  envio_gratis_desde: 'Monto de envío gratis, con formato de precio',
  descuento_transferencia: 'Porcentaje de descuento por transferencia',
}
