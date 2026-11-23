// Search synonyms (sheet Sinonimos, NAV-06). The target is a code of the
// taxonomy its type names; "Intención" has no taxonomy and takes any code.
import type { SynonymType } from '@prisma/client'
import { audit } from '@/server/audit'
import { LISTS } from '@/server/catalog-import/lists'
import { CODE_RE, codeMessage } from '@/server/catalog-import/rules'
import { fail, ok, type Actor, type Db, type Result } from './common'

export const SYNONYM_TYPES = LISTS.tipo_sinonimo.labels.map(([label, value]) => ({ value, label }))

/** Same targets as the import checks. */
async function targetExists(db: Db, type: SynonymType, code: string): Promise<boolean> {
  const where = { code }
  switch (type) {
    case 'SKIN_TYPE':
      return !!(await db.skinType.findUnique({ where }))
    case 'CONCERN':
      return !!(await db.concern.findUnique({ where }))
    case 'PRODUCT_TYPE':
      return !!(await db.category.findUnique({ where }))
    case 'BRAND':
      return !!(await db.brand.findUnique({ where }))
    case 'INGREDIENT':
      return !!(await db.ingredient.findUnique({ where }))
    case 'INTENT':
      return true
  }
}

export async function saveSynonym(db: Db, actor: Actor, id: string | null, input: { term?: string; type?: string; targetCode?: string; variants?: string }): Promise<Result> {
  const errors: Record<string, string> = {}
  const term = (input.term ?? '').trim()
  const type = input.type as SynonymType
  const targetCode = (input.targetCode ?? '').trim()
  const variants = [
    ...new Set(
      (input.variants ?? '')
        .split(/\r?\n|;/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ]
  if (!term) errors.term = 'Campo obligatorio.'
  if (!SYNONYM_TYPES.some((t) => t.value === type)) errors.type = 'Elegí un tipo.'
  if (!targetCode) errors.targetCode = 'Campo obligatorio.'
  else if (!CODE_RE.test(targetCode)) errors.targetCode = codeMessage(targetCode)
  else if (!errors.type && !(await targetExists(db, type, targetCode))) errors.targetCode = `"${targetCode}" no existe para el tipo elegido.`
  if (!variants.length) errors.variants = 'Escribí al menos una forma de buscarlo.'
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)

  const twin = await db.synonym.findUnique({ where: { type_targetCode_term: { type, targetCode, term } } })
  if (twin && twin.id !== id) return fail('Ya hay un sinónimo con ese término, tipo y destino.', { term: 'Ya existe.' })
  const data = { term, type, targetCode, variants }
  if (id === null) {
    await db.$transaction(async (tx) => {
      const s = await tx.synonym.create({ data })
      await audit(tx, actor, { action: 'create', entityType: 'Synonym', entityId: s.id, label: term, after: data })
    })
    return ok('Sinónimo creado.')
  }
  const before = await db.synonym.findUnique({ where: { id } })
  if (!before) return fail('El sinónimo no existe.')
  await db.$transaction(async (tx) => {
    await tx.synonym.update({ where: { id }, data })
    await audit(tx, actor, { action: 'update', entityType: 'Synonym', entityId: id, label: term, before: { term: before.term, type: before.type, targetCode: before.targetCode, variants: before.variants }, after: data })
  })
  return ok('Sinónimo guardado.')
}

/** Synonyms have no trash: they are a search aid and easy to write again. */
export async function deleteSynonym(db: Db, actor: Actor, id: string): Promise<Result> {
  const s = await db.synonym.findUnique({ where: { id } })
  if (!s) return fail('El sinónimo no existe.')
  await db.$transaction(async (tx) => {
    await tx.synonym.delete({ where: { id } })
    await audit(tx, actor, { action: 'delete', entityType: 'Synonym', entityId: id, label: s.term, before: { term: s.term, type: s.type, targetCode: s.targetCode, variants: s.variants } })
  })
  return ok('Sinónimo borrado.')
}
