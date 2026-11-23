// Catalog export (CAT-02): the whole catalog in template v1.1, the same
// sheets, columns and list labels the importer reads, so exporting and
// importing the file back changes nothing (03 §3.7). Rows follow creation
// order. Soft-deleted records stay out; ingredients created from INCI lists
// and still to review stay out too, because the INCI text recreates them.
import ExcelJS from 'exceljs'
import type { Prisma, PrismaClient } from '@prisma/client'
import { splitInci } from '@/server/catalog-import/inci'
import { inciMatcher } from '@/server/catalog-import/ingredient-list'
import { LISTS, labelOf, type ListDef } from '@/server/catalog-import/lists'
import { SHEETS, type SheetName } from '@/server/catalog-import/spec'

export type Cell = string | number | null
export type ExportRows = Record<SheetName, Record<string, Cell>[]>
export type ExportOptions = {
  /** costo_ars is written only for a role that may see cost (CAT-20); without it the column is left out. */
  includeCost: boolean
}

const byCreation = [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
const live = { deletedAt: null }

const yesNo = (v: boolean | null | undefined) => (v === null || v === undefined ? null : v ? 'Sí' : 'No')
const label = <T extends string>(def: ListDef<T>, v: T | null | undefined) => (v === null || v === undefined ? null : labelOf(def, v))
const joined = (values: string[], sep: '; ' | ' | ') => (values.length ? values.join(sep) : null)
const num = (v: Prisma.Decimal | number | null | undefined) => (v === null || v === undefined ? null : Number(v))
const pesos = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : cents / 100)

/** The catalog as template rows, one object per row keyed by column. */
export async function exportRows(db: PrismaClient, options: ExportOptions): Promise<ExportRows> {
  const [brands, categories, concerns, skinTypes, families, allIngredients, conflicts, familyConflicts, products, criteria, routines, endorsements, knowledge, synonyms] =
    await Promise.all([
      db.brand.findMany({ where: live, orderBy: byCreation }),
      db.category.findMany({ where: live, orderBy: byCreation, include: { parent: { select: { code: true } } } }),
      db.concern.findMany({ where: live, orderBy: byCreation }),
      db.skinType.findMany({ where: live, orderBy: byCreation }),
      db.ingredientFamily.findMany({ orderBy: byCreation }),
      db.ingredient.findMany({ orderBy: byCreation, include: { family: { select: { code: true } }, concerns: { include: { concern: { select: { code: true } } } } } }),
      db.ingredientConflict.findMany({ orderBy: { id: 'asc' }, include: { ingredientA: { select: { code: true } }, ingredientB: { select: { code: true } } } }),
      db.familyConflict.findMany({ orderBy: { id: 'asc' }, include: { familyA: { select: { code: true } }, familyB: { select: { code: true } } } }),
      db.product.findMany({
        where: live,
        orderBy: byCreation,
        include: {
          brand: { select: { code: true } },
          category: { select: { code: true } },
          baseProduct: { select: { code: true } },
          relations: { orderBy: { position: 'asc' }, include: { related: { select: { code: true } } } },
          variants: { orderBy: byCreation },
          ingredients: { orderBy: { inciOrder: 'asc' }, include: { ingredient: { select: { code: true } } } },
          concerns: { include: { concern: { select: { code: true } } } },
          skinTypes: { include: { skinType: { select: { code: true } } } },
          evaluations: { include: { criterion: { select: { code: true } } } },
        },
      }),
      db.evaluationCriterion.findMany({ orderBy: { id: 'asc' } }),
      db.routine.findMany({
        where: live,
        orderBy: byCreation,
        include: {
          skinTypes: { include: { skinType: { select: { code: true } } } },
          concerns: { include: { concern: { select: { code: true } } } },
          steps: { orderBy: { position: 'asc' }, include: { mainProduct: { select: { code: true } }, alternatives: { orderBy: { position: 'asc' }, include: { product: { select: { code: true } } } } } },
        },
      }),
      db.endorsement.findMany({ orderBy: byCreation }),
      db.knowledgeEntry.findMany({ orderBy: byCreation }),
      db.synonym.findMany({ orderBy: { id: 'asc' } }),
    ])

  const ingredients = allIngredients.filter((i) => i.deletedAt === null && i.status === 'ACTIVE')

  // The same INCI matching the importer will run on the file, to know which
  // ingredient rows the INCI text already gives (CAT-19): only star rows,
  // concentrations and rows outside the text need Prod_Ingredientes.
  const exported = new Set(ingredients.map((i) => i.code))
  const byInci = new Map<string, string>()
  for (const i of allIngredients) if (!exported.has(i.code)) byInci.set(i.inciKey, i.code)
  const inSheet = new Set<string>()
  for (const i of ingredients) {
    const other = byInci.get(i.inciKey)
    if (other && inSheet.has(other)) continue
    byInci.set(i.inciKey, i.code)
    inSheet.add(i.code)
  }
  const fromInci = (text: string) => {
    const matcher = inciMatcher(new Map(byInci), new Set(allIngredients.map((i) => i.code)))
    return new Set(splitInci(text).map(matcher.match))
  }

  const productRows: Record<string, Cell>[] = []
  const variantRows: Record<string, Cell>[] = []
  const piRows: Record<string, Cell>[] = []
  const pnRows: Record<string, Cell>[] = []
  const ptRows: Record<string, Cell>[] = []
  const evalRows: Record<string, Cell>[] = []
  for (const p of products) {
    const rel = (kind: 'COMPATIBLE' | 'COMPLEMENTARY' | 'ALTERNATIVE') => joined(p.relations.filter((r) => r.kind === kind).map((r) => r.related.code), '; ')
    productRows.push({
      codigo_producto: p.code,
      nombre: p.name,
      marca: p.brand.code,
      categoria: p.category.code,
      estado: labelOf(LISTS.estado, p.status),
      descripcion_corta: p.shortDescription,
      descripcion: p.description,
      beneficios: joined(p.benefits, ' | '),
      por_que_lo_elegimos: p.whyWeChose,
      evaluacion_puntaje: p.evaluationScore,
      evaluacion_notas: p.evaluationNotes,
      modo_de_uso: p.howToUse,
      precauciones: p.precautions,
      textura: p.texture,
      // The loaded value, kept as a check; the flag itself is computed (CAT-08).
      sin_fragancia: yesNo(p.fragranceFreeDeclared),
      paso_rutina: labelOf(LISTS.paso, p.routineStep),
      momento: labelOf(LISTS.momento, p.moment),
      duracion_dias: p.durationDays,
      compatibles: rel('COMPATIBLE'),
      complementarios: rel('COMPLEMENTARY'),
      alternativas: rel('ALTERNATIVE'),
      imagenes: joined(p.images, '; '),
      video_url: p.videoUrl,
      seo_titulo: p.seoTitle,
      seo_descripcion: p.seoDescription,
      nivel: label(LISTS.nivel, p.level),
      tipo: labelOf(LISTS.tipo_producto, p.type),
      prioridad: p.priority,
      producto_base: p.baseProduct?.code ?? null,
      contenido_kit: joined(p.kitContents, '; '),
      linea: p.line,
      frase_principal: p.headline,
      chips: joined(p.chips, ' | '),
      etiquetas: joined(p.labels.map((l) => labelOf(LISTS.etiqueta, l)), '; '),
      vegano: labelOf(LISTS.si_no_sindato, p.vegan),
      cruelty_free: labelOf(LISTS.si_no_sindato, p.crueltyFree),
      testeado_dermatologicamente: labelOf(LISTS.si_no_sindato, p.dermatologistTested),
      fuente_sellos: p.sealSource,
      anmat_registro: p.anmatRegistration,
      titular_importador: p.importerHolder,
      pais_origen: p.countryOfOrigin,
      textura_descripcion: p.textureDescription,
      tips: p.tips,
      pao_meses: p.paoMonths,
      alicuota_iva: num(p.vatRate),
      inci: p.inciText,
    })

    for (const v of p.variants) {
      const row: Record<string, Cell> = {
        sku: v.sku,
        codigo_producto: p.code,
        tamano: num(v.size),
        unidad: labelOf(LISTS.unidad, v.unit),
        precio_ars: pesos(v.priceCents),
        precio_promocional_ars: pesos(v.promoPriceCents),
        stock: v.stock,
        codigo_barras: v.barcode,
        peso_g: v.weightGrams,
        variante_principal: yesNo(v.isMain),
        duracion_dias: v.durationDays,
        alto_cm: num(v.heightCm),
        ancho_cm: num(v.widthCm),
        largo_cm: num(v.lengthCm),
      }
      if (options.includeCost) row.costo_ars = pesos(v.costCents)
      variantRows.push(row)
    }

    const textCodes = p.inciText ? fromInci(p.inciText) : null
    for (const pi of p.ingredients) {
      if (textCodes && !pi.isStar && !pi.concentration && textCodes.has(pi.ingredient.code)) continue
      piRows.push({ codigo_producto: p.code, codigo_ingrediente: pi.ingredient.code, orden_inci: pi.inciOrder, es_activo_clave: yesNo(pi.isStar), concentracion: pi.concentration })
    }
    for (const c of [...p.concerns].sort((a, b) => b.relevance - a.relevance || a.concern.code.localeCompare(b.concern.code)))
      pnRows.push({ codigo_producto: p.code, codigo_necesidad: c.concern.code, relevancia: c.relevance })
    for (const s of [...p.skinTypes].sort((a, b) => a.skinType.code.localeCompare(b.skinType.code)))
      ptRows.push({ codigo_producto: p.code, codigo_tipo_piel: s.skinType.code, aptitud: labelOf(LISTS.aptitud, s.aptitude) })
    for (const e of [...p.evaluations].sort((a, b) => a.criterion.code.localeCompare(b.criterion.code)))
      evalRows.push({ codigo_producto: p.code, codigo_criterio: e.criterion.code, puntaje: e.score, nota: e.note })
  }

  return {
    Marcas: brands.map((b) => ({ codigo_marca: b.code, nombre: b.name, pais_origen: b.countryOfOrigin, descripcion: b.description, logo_archivo: b.logoFile })),
    Categorias: categories.map((c) => ({ codigo_categoria: c.code, nombre: c.name, categoria_padre: c.parent?.code ?? null, orden: c.sortOrder, descripcion: c.description })),
    Necesidades: concerns.map((c) => ({ codigo_necesidad: c.code, nombre: c.name, etiqueta_corta: c.shortLabel, descripcion_corta: c.shortDescription, contenido_editorial: c.editorialContent })),
    TiposDePiel: skinTypes.map((s) => ({ codigo_tipo_piel: s.code, nombre: s.name, descripcion: s.description })),
    Familias: families.map((f) => ({
      codigo_familia: f.code,
      nombre: f.name,
      advertencia: f.warning,
      excluible_en_diagnostico: yesNo(f.excludableInDiagnosis),
      no_duplicar: yesNo(f.noDuplicate),
      calcula: joined(f.computes, '; '),
    })),
    Ingredientes: ingredients.map((i) => ({
      codigo_ingrediente: i.code,
      nombre_comun: i.commonName,
      nombre_inci: i.inciName,
      es_activo_clave: yesNo(i.isKeyActive),
      es_irritante: yesNo(i.isIrritant),
      descripcion: i.description,
      necesidades: joined(i.concerns.map((c) => c.concern.code).sort(), '; '),
      familia: i.family?.code ?? null,
    })),
    Conflictos: conflicts.map((c) => ({ ingrediente_a: c.ingredientA.code, ingrediente_b: c.ingredientB.code, severidad: labelOf(LISTS.severidad, c.severity), nota: c.note })),
    Conflictos_Familias: familyConflicts.map((c) => ({ familia_a: c.familyA.code, familia_b: c.familyB.code, severidad: labelOf(LISTS.severidad, c.severity), nota: c.note })),
    Productos: productRows,
    Criterios: criteria.map((c) => ({ codigo_criterio: c.code, nombre: c.name, peso: num(c.weight), descripcion: c.description })),
    Evaluacion: evalRows,
    Variantes: variantRows,
    Prod_Ingredientes: piRows,
    Prod_Necesidades: pnRows,
    Prod_TiposPiel: ptRows,
    Rutinas: routines.map((r) => ({
      codigo_rutina: r.code,
      nombre: r.name,
      objetivo: r.goal,
      momento: labelOf(LISTS.momento, r.moment),
      tipos_piel: joined(r.skinTypes.map((s) => s.skinType.code).sort(), '; '),
      necesidades: joined(r.concerns.map((c) => c.concern.code).sort(), '; '),
      dificultad: label(LISTS.dificultad, r.difficulty),
      descuento_pct: r.discountPct,
      descripcion: r.description,
    })),
    Pasos_Rutina: routines.flatMap((r) =>
      r.steps.map((s) => ({
        codigo_rutina: r.code,
        orden: s.position,
        momento: labelOf(LISTS.momento, s.moment),
        tipo_paso: labelOf(LISTS.paso, s.stepType),
        titulo: s.title,
        producto_principal: s.mainProduct.code,
        alternativas: joined(s.alternatives.map((a) => a.product.code), '; '),
        instruccion: s.instruction,
        frecuencia: s.frequency,
        opcional: yesNo(s.optional),
      })),
    ),
    Avales: endorsements.map((e) => ({
      codigo_producto: e.targetCode,
      entidad: e.entity,
      detalle: e.detail,
      cita: e.quote,
      imagen: e.image,
      tipo: labelOf(LISTS.tipo_aval, e.targetType),
      activo: yesNo(e.active),
    })),
    Base_Conocimiento: knowledge.map((k) => ({
      codigo: k.code,
      categoria: labelOf(LISTS.categoria_kb, k.category),
      pregunta: k.question,
      respuesta: k.answer,
      palabras_clave: joined(k.keywords, '; '),
      activa: yesNo(k.active),
    })),
    Sinonimos: synonyms.map((s) => ({ termino: s.term, tipo: labelOf(LISTS.tipo_sinonimo, s.type), codigo_destino: s.targetCode, sinonimos: joined(s.variants, '; ') })),
  }
}

const REQUIREMENT: Record<string, string> = { S1: 'Siempre (muestra S1)', S5: 'Catálogo completo (S5)', row: 'Si la fila existe', opt: 'Opcional' }
const TYPE: Record<string, string> = {
  text: 'Texto',
  code: 'Código',
  ref: 'Código de otra hoja',
  refs: 'Códigos separados por ;',
  texts: 'Textos separados por ;',
  pipes: 'Textos separados por |',
  int: 'Número entero',
  number: 'Número',
  money: 'Pesos, sin puntos ni símbolo',
  list: 'Lista',
  multi: 'Lista (varios, separados por ;)',
  yesno: 'Sí / No',
}

/** The rows as an .xlsx in the template's layout: Leame and Diccionario first, the 19 data sheets, Listas last. */
export async function toXlsx(rows: ExportRows, options: ExportOptions & { generatedAt?: Date } = { includeCost: false }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'LaRutina'
  const generatedAt = options.generatedAt ?? new Date()
  wb.created = generatedAt

  const leame = wb.addWorksheet('Leame')
  for (const line of [
    'Catálogo exportado desde el panel de LaRutina, en la plantilla v1.1.',
    `Generado: ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} (UTC).`,
    'Se puede editar y volver a importar desde Catálogo › Importar planilla: importar este archivo sin cambios no modifica nada.',
    'Códigos en minúsculas, números y guiones; nunca se cambian ni se reutilizan. Varios valores separados por ";"; beneficios y chips por "|". Precios en pesos, sin puntos ni símbolo.',
    options.includeCost ? 'Incluye la columna costo_ars (solo visible para Administración).' : 'Sin la columna costo_ars: al importarlo, los costos cargados no cambian.',
  ])
    leame.addRow([line])
  leame.getColumn(1).width = 120

  const dict = wb.addWorksheet('Diccionario')
  dict.addRow(['Hoja', 'Campo', 'Cuándo es obligatorio', 'Tipo de dato', 'Lista'])
  dict.getRow(1).font = { bold: true }
  for (const spec of Object.values(SHEETS))
    for (const f of spec.fields) {
      if (f.key === 'costo_ars' && !options.includeCost) continue
      dict.addRow([spec.name, f.key, REQUIREMENT[f.req], TYPE[f.type], f.list ?? ''])
    }
  dict.columns.forEach((c) => (c.width = 26))

  for (const spec of Object.values(SHEETS)) {
    const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    const headers = spec.fields.map((f) => f.key).filter((k) => k !== 'costo_ars' || options.includeCost)
    ws.addRow(headers)
    ws.getRow(1).font = { bold: true }
    for (const r of rows[spec.name as SheetName]) ws.addRow(headers.map((h) => r[h] ?? null))
    headers.forEach((h, i) => (ws.getColumn(i + 1).width = Math.min(40, Math.max(12, h.length + 4))))
  }

  const listas = wb.addWorksheet('Listas')
  const lists = Object.values(LISTS)
  listas.addRow(lists.map((l) => l.name))
  listas.getRow(1).font = { bold: true }
  const longest = Math.max(...lists.map((l) => l.labels.length))
  for (let i = 0; i < longest; i++) listas.addRow(lists.map((l) => l.labels[i]?.[0] ?? null))

  return Buffer.from(await wb.xlsx.writeBuffer())
}

export const exportFileName = (at = new Date()) => `LaRutina-Catalogo-v1.1-${at.toISOString().slice(0, 10)}.xlsx`

/** Number of rows per sheet, for the audit entry. */
export const rowCounts = (rows: ExportRows) => Object.fromEntries(Object.entries(rows).filter(([, list]) => list.length).map(([sheet, list]) => [sheet, list.length]))
