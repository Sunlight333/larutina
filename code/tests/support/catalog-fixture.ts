// A small, made-up catalog in template v1.1, for tests. The client's real
// sample stays out of this public repository.
import ExcelJS from 'exceljs'
import { SHEETS, type SheetName } from '../../src/server/catalog-import/spec'
import type { Workbook } from '../../src/server/catalog-import/workbook'

export type FixtureRows = Partial<Record<SheetName, Record<string, string>[]>>

export function baseCatalog(): FixtureRows {
  return {
    Marcas: [{ codigo_marca: 'marca-a', nombre: 'Marca A' }],
    Categorias: [
      { codigo_categoria: 'tratamiento', nombre: 'Tratamiento' },
      { codigo_categoria: 'serums', nombre: 'Sérums', categoria_padre: 'tratamiento' },
      { codigo_categoria: 'limpiadores', nombre: 'Limpiadores' },
    ],
    Necesidades: [{ codigo_necesidad: 'manchas', nombre: 'Manchas y tono desparejo', etiqueta_corta: 'Manchas' }],
    TiposDePiel: [
      { codigo_tipo_piel: 'grasa', nombre: 'Grasa' },
      { codigo_tipo_piel: 'sensible', nombre: 'Sensible' },
    ],
    Familias: [
      { codigo_familia: 'retinoide', nombre: 'Retinoide', excluible_en_diagnostico: 'Sí', no_duplicar: 'Sí', calcula: 'contiene_retinoide' },
      { codigo_familia: 'fragancia', nombre: 'Fragancia', excluible_en_diagnostico: 'Sí', no_duplicar: 'No', calcula: 'sin_fragancia' },
    ],
    Ingredientes: [
      { codigo_ingrediente: 'agua', nombre_comun: 'Agua', nombre_inci: 'Water', es_activo_clave: 'No', es_irritante: 'No' },
      { codigo_ingrediente: 'niacinamida', nombre_comun: 'Niacinamida', nombre_inci: 'Niacinamide', es_activo_clave: 'Sí', es_irritante: 'No', necesidades: 'manchas' },
      { codigo_ingrediente: 'retinol', nombre_comun: 'Retinol', nombre_inci: 'Retinol', es_activo_clave: 'Sí', es_irritante: 'Sí', familia: 'retinoide' },
      { codigo_ingrediente: 'perfume', nombre_comun: 'Perfume', nombre_inci: 'Parfum', es_activo_clave: 'No', es_irritante: 'Sí', familia: 'fragancia' },
    ],
    Conflictos: [],
    Productos: [
      product('ma-serum', { inci: 'Water, Niacinamide, Retinol', sin_fragancia: 'Sí', complementarios: 'ma-gel' }),
      product('ma-gel', { categoria: 'limpiadores', paso_rutina: 'Limpiador', inci: 'Aqua (Water), Parfum', sin_fragancia: 'No' }),
    ],
    Variantes: [
      variant('MA-SER-30', 'ma-serum', { variante_principal: 'Sí' }),
      variant('MA-GEL-150', 'ma-gel', { precio_ars: '9900', variante_principal: 'Sí' }),
    ],
    Prod_Ingredientes: [{ codigo_producto: 'ma-serum', codigo_ingrediente: 'niacinamida', orden_inci: '2', es_activo_clave: 'Sí', concentracion: '10%' }],
    Prod_Necesidades: [
      { codigo_producto: 'ma-serum', codigo_necesidad: 'manchas', relevancia: '80' },
      { codigo_producto: 'ma-gel', codigo_necesidad: 'manchas', relevancia: '20' },
    ],
    Prod_TiposPiel: [
      { codigo_producto: 'ma-serum', codigo_tipo_piel: 'grasa', aptitud: 'Ideal' },
      { codigo_producto: 'ma-gel', codigo_tipo_piel: 'grasa', aptitud: 'Apto' },
    ],
    Rutinas: [{ codigo_rutina: 'rutina-a', nombre: 'Rutina A', objetivo: 'Probar.', momento: 'PM', tipos_piel: 'grasa', necesidades: 'manchas' }],
    Pasos_Rutina: [
      { codigo_rutina: 'rutina-a', orden: '1', momento: 'PM', tipo_paso: 'Limpiador', titulo: 'Limpiar', producto_principal: 'ma-gel' },
      { codigo_rutina: 'rutina-a', orden: '2', momento: 'PM', tipo_paso: 'Sérum', titulo: 'Tratar', producto_principal: 'ma-serum' },
    ],
  }
}

export function product(code: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    codigo_producto: code,
    nombre: `Producto ${code}`,
    marca: 'marca-a',
    categoria: 'serums',
    estado: 'Activo',
    descripcion_corta: 'Corta.',
    descripcion: 'Larga.',
    beneficios: 'CALMÁ: baja las rojeces | HIDRATÁ: retiene agua',
    por_que_lo_elegimos: 'Porque sí.',
    evaluacion_puntaje: '80',
    modo_de_uso: 'Aplicar.',
    textura: 'Fluido',
    paso_rutina: 'Sérum',
    momento: 'PM',
    imagenes: `${code}_1.jpg`,
    ...extra,
  }
}

export function variant(sku: string, productCode: string, extra: Record<string, string> = {}): Record<string, string> {
  return { sku, codigo_producto: productCode, tamano: '30', unidad: 'ml', precio_ars: '18900', stock: '5', variante_principal: 'No', ...extra }
}

/** The fixture as the parsed workbook validate.ts reads (rows numbered from 2, like the sheet). */
export function toWorkbook(rows: FixtureRows): Workbook {
  const wb: Workbook = new Map()
  for (const spec of Object.values(SHEETS)) {
    const data = rows[spec.name as SheetName] ?? []
    wb.set(spec.name, {
      name: spec.name,
      headers: spec.fields.map((f) => f.key),
      rows: data.map((cells, i) => ({ row: i + 2, cells })),
    })
  }
  return wb
}

/** The fixture as a real .xlsx file, to go through the whole import path. */
export async function toXlsx(rows: FixtureRows): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const spec of Object.values(SHEETS)) {
    const ws = wb.addWorksheet(spec.name)
    const headers = spec.fields.map((f) => f.key)
    ws.addRow([...headers, 'Control'])
    for (const r of rows[spec.name as SheetName] ?? []) ws.addRow(headers.map((h) => r[h] ?? null))
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
