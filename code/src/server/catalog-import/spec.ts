// Template v1.1, sheet by sheet: every column the importer reads, its type and
// when it is required (A3 import contract). The export writes the same
// columns in the same order, so a round trip changes nothing.
import type { ListName } from './lists'

/**
 * text    free text
 * code    a code of this sheet: lowercase letters, digits and hyphens
 * ref     a code of another sheet (format checked here, existence in validate.ts)
 * refs    several codes separated by ";"
 * texts   several texts separated by ";"
 * pipes   several texts separated by "|"
 * int     whole number; number: decimal allowed; money: pesos, up to 2 decimals
 * list    one value of a list; multi: several, separated by ";"
 * yesno   Sí / No
 */
export type FieldType = 'text' | 'code' | 'ref' | 'refs' | 'texts' | 'pipes' | 'int' | 'number' | 'money' | 'list' | 'multi' | 'yesno'

/**
 * S1   required in the sample and in the full catalog
 * S5   required in the full catalog; reported as missing in a sample import
 * row  required whenever the row exists (identity of a row in an optional sheet)
 * opt  optional
 */
export type Requirement = 'S1' | 'S5' | 'row' | 'opt'

export type Field = {
  key: string
  type: FieldType
  req: Requirement
  list?: ListName
  min?: number
  max?: number
  maxLength?: number
  /** Without the column, the stored values stay as they are (cost in an export for a role without cost, CAT-20). */
  keepWhenAbsent?: boolean
}

export type SheetSpec = {
  name: string
  fields: Field[]
  /** New in v1.1: a file without this sheet is still valid. */
  optionalSheet?: boolean
}

const f = (key: string, type: FieldType, req: Requirement, extra: Partial<Field> = {}): Field => ({ key, type, req, ...extra })

export const SHEETS = {
  Marcas: {
    name: 'Marcas',
    fields: [
      f('codigo_marca', 'code', 'S1'),
      f('nombre', 'text', 'S1'),
      f('pais_origen', 'text', 'S5'),
      f('descripcion', 'text', 'S5'),
      f('logo_archivo', 'text', 'opt'),
    ],
  },
  Categorias: {
    name: 'Categorias',
    fields: [
      f('codigo_categoria', 'code', 'S1'),
      f('nombre', 'text', 'S1'),
      f('categoria_padre', 'ref', 'opt'),
      f('orden', 'int', 'S5', { min: 1 }),
      f('descripcion', 'text', 'S5'),
    ],
  },
  Necesidades: {
    name: 'Necesidades',
    fields: [
      f('codigo_necesidad', 'code', 'S1'),
      f('nombre', 'text', 'S1'),
      f('etiqueta_corta', 'text', 'S1', { maxLength: 18 }),
      f('descripcion_corta', 'text', 'S5'),
      f('contenido_editorial', 'text', 'opt'),
    ],
  },
  TiposDePiel: {
    name: 'TiposDePiel',
    fields: [f('codigo_tipo_piel', 'code', 'S1'), f('nombre', 'text', 'S1'), f('descripcion', 'text', 'S5')],
  },
  Familias: {
    name: 'Familias',
    optionalSheet: true,
    fields: [
      f('codigo_familia', 'code', 'row'),
      f('nombre', 'text', 'row'),
      f('advertencia', 'text', 'opt'),
      f('excluible_en_diagnostico', 'yesno', 'S5'),
      f('no_duplicar', 'yesno', 'S5'),
      f('calcula', 'texts', 'opt'),
    ],
  },
  Ingredientes: {
    name: 'Ingredientes',
    fields: [
      f('codigo_ingrediente', 'code', 'S1'),
      f('nombre_comun', 'text', 'S1'),
      f('nombre_inci', 'text', 'S1'),
      f('es_activo_clave', 'yesno', 'S1'),
      f('es_irritante', 'yesno', 'S1'),
      f('descripcion', 'text', 'opt'), // required in S5 for key actives only (validate.ts)
      f('necesidades', 'refs', 'opt'),
      f('familia', 'ref', 'opt'),
    ],
  },
  Conflictos: {
    name: 'Conflictos',
    fields: [
      f('ingrediente_a', 'ref', 'row'),
      f('ingrediente_b', 'ref', 'row'),
      f('severidad', 'list', 'row', { list: 'severidad' }),
      f('nota', 'text', 'S5'),
    ],
  },
  Conflictos_Familias: {
    name: 'Conflictos_Familias',
    optionalSheet: true,
    fields: [
      f('familia_a', 'ref', 'row'),
      f('familia_b', 'ref', 'row'),
      f('severidad', 'list', 'row', { list: 'severidad' }),
      f('nota', 'text', 'opt'),
    ],
  },
  Productos: {
    name: 'Productos',
    fields: [
      f('codigo_producto', 'code', 'S1'),
      f('nombre', 'text', 'S1'),
      f('marca', 'ref', 'S1'),
      f('categoria', 'ref', 'S1'),
      f('estado', 'list', 'S1', { list: 'estado' }),
      f('descripcion_corta', 'text', 'S1'),
      f('descripcion', 'text', 'S1'),
      f('beneficios', 'pipes', 'S1'),
      f('por_que_lo_elegimos', 'text', 'S1'),
      f('evaluacion_puntaje', 'int', 'S1', { min: 0, max: 100 }),
      f('evaluacion_notas', 'text', 'S5'),
      f('modo_de_uso', 'text', 'S1'),
      f('precauciones', 'text', 'S5'),
      f('textura', 'list', 'S1', { list: 'textura' }),
      f('sin_fragancia', 'yesno', 'S5'),
      f('paso_rutina', 'list', 'S1', { list: 'paso' }),
      f('momento', 'list', 'S1', { list: 'momento' }),
      f('duracion_dias', 'int', 'S5', { min: 1 }),
      f('compatibles', 'refs', 'opt'),
      f('complementarios', 'refs', 'S5'),
      f('alternativas', 'refs', 'opt'),
      f('imagenes', 'texts', 'S1'),
      f('video_url', 'text', 'opt'),
      f('seo_titulo', 'text', 'opt'),
      f('seo_descripcion', 'text', 'opt'),
      f('nivel', 'list', 'S5', { list: 'nivel' }),
      f('tipo', 'list', 'S5', { list: 'tipo_producto' }),
      f('prioridad', 'int', 'opt', { min: 1 }),
      f('producto_base', 'ref', 'opt'),
      f('contenido_kit', 'texts', 'opt'),
      f('linea', 'text', 'opt'),
      f('frase_principal', 'text', 'S5'),
      f('chips', 'pipes', 'opt'),
      f('etiquetas', 'multi', 'opt', { list: 'etiqueta' }),
      f('vegano', 'list', 'opt', { list: 'si_no_sindato' }),
      f('cruelty_free', 'list', 'opt', { list: 'si_no_sindato' }),
      f('testeado_dermatologicamente', 'list', 'opt', { list: 'si_no_sindato' }),
      f('fuente_sellos', 'text', 'opt'),
      f('anmat_registro', 'text', 'S5'),
      f('titular_importador', 'text', 'S5'),
      f('pais_origen', 'text', 'opt'),
      f('textura_descripcion', 'text', 'opt'),
      f('tips', 'text', 'opt'),
      f('pao_meses', 'int', 'opt', { min: 1 }),
      f('alicuota_iva', 'number', 'opt', { min: 0, max: 100 }),
      f('inci', 'text', 'S5'),
    ],
  },
  Criterios: {
    name: 'Criterios',
    optionalSheet: true,
    fields: [
      f('codigo_criterio', 'code', 'row'),
      f('nombre', 'text', 'row'),
      f('peso', 'number', 'row', { min: 0 }),
      f('descripcion', 'text', 'opt'),
    ],
  },
  Evaluacion: {
    name: 'Evaluacion',
    optionalSheet: true,
    fields: [
      f('codigo_producto', 'ref', 'row'),
      f('codigo_criterio', 'ref', 'row'),
      f('puntaje', 'int', 'row', { min: 0, max: 100 }),
      f('nota', 'text', 'opt'),
    ],
  },
  Variantes: {
    name: 'Variantes',
    fields: [
      f('sku', 'text', 'S1'),
      f('codigo_producto', 'ref', 'S1'),
      f('tamano', 'number', 'S1', { min: 0 }),
      f('unidad', 'list', 'S1', { list: 'unidad' }),
      f('precio_ars', 'money', 'S1', { min: 0 }),
      f('precio_promocional_ars', 'money', 'opt', { min: 0 }),
      f('stock', 'int', 'S1', { min: 0 }),
      f('codigo_barras', 'text', 'opt'),
      f('peso_g', 'int', 'S5', { min: 1 }),
      f('variante_principal', 'yesno', 'S1'),
      f('duracion_dias', 'int', 'S5', { min: 1 }),
      f('alto_cm', 'number', 'opt', { min: 0 }),
      f('ancho_cm', 'number', 'opt', { min: 0 }),
      f('largo_cm', 'number', 'opt', { min: 0 }),
      f('costo_ars', 'money', 'opt', { min: 0, keepWhenAbsent: true }),
    ],
  },
  Prod_Ingredientes: {
    name: 'Prod_Ingredientes',
    fields: [
      f('codigo_producto', 'ref', 'S1'),
      f('codigo_ingrediente', 'ref', 'S1'),
      f('orden_inci', 'int', 'S1', { min: 1 }),
      f('es_activo_clave', 'yesno', 'S1'),
      f('concentracion', 'text', 'opt'),
    ],
  },
  Prod_Necesidades: {
    name: 'Prod_Necesidades',
    fields: [f('codigo_producto', 'ref', 'S1'), f('codigo_necesidad', 'ref', 'S1'), f('relevancia', 'int', 'S1', { min: 0, max: 100 })],
  },
  Prod_TiposPiel: {
    name: 'Prod_TiposPiel',
    fields: [f('codigo_producto', 'ref', 'S1'), f('codigo_tipo_piel', 'ref', 'S1'), f('aptitud', 'list', 'S1', { list: 'aptitud' })],
  },
  Rutinas: {
    name: 'Rutinas',
    fields: [
      f('codigo_rutina', 'code', 'S1'),
      f('nombre', 'text', 'S1'),
      f('objetivo', 'text', 'S1'),
      f('momento', 'list', 'S1', { list: 'momento' }),
      f('tipos_piel', 'refs', 'S1'),
      f('necesidades', 'refs', 'S1'),
      f('dificultad', 'list', 'S5', { list: 'dificultad' }),
      f('descuento_pct', 'int', 'opt', { min: 0, max: 100 }),
      f('descripcion', 'text', 'S5'),
    ],
  },
  Pasos_Rutina: {
    name: 'Pasos_Rutina',
    fields: [
      f('codigo_rutina', 'ref', 'S1'),
      f('orden', 'int', 'S1', { min: 1 }),
      f('momento', 'list', 'S1', { list: 'momento' }),
      f('tipo_paso', 'list', 'S1', { list: 'paso' }),
      f('titulo', 'text', 'S1'),
      f('producto_principal', 'ref', 'S1'),
      f('alternativas', 'refs', 'opt'),
      f('instruccion', 'text', 'S5'),
      f('frecuencia', 'text', 'opt'),
      f('opcional', 'yesno', 'S5'),
    ],
  },
  Avales: {
    name: 'Avales',
    optionalSheet: true,
    fields: [
      f('codigo_producto', 'ref', 'row'),
      f('entidad', 'text', 'row'),
      f('detalle', 'text', 'opt'),
      f('cita', 'text', 'opt'),
      f('imagen', 'text', 'opt'),
      f('tipo', 'list', 'row', { list: 'tipo_aval' }),
      f('activo', 'yesno', 'opt'),
    ],
  },
  Base_Conocimiento: {
    name: 'Base_Conocimiento',
    fields: [
      f('codigo', 'code', 'row'),
      f('categoria', 'list', 'row', { list: 'categoria_kb' }),
      f('pregunta', 'text', 'row'),
      f('respuesta', 'text', 'row'),
      f('palabras_clave', 'texts', 'S5'),
      f('activa', 'yesno', 'S5'),
    ],
  },
  Sinonimos: {
    name: 'Sinonimos',
    fields: [
      f('termino', 'text', 'row'),
      f('tipo', 'list', 'row', { list: 'tipo_sinonimo' }),
      f('codigo_destino', 'text', 'row'),
      f('sinonimos', 'texts', 'row'),
    ],
  },
} satisfies Record<string, SheetSpec>

export type SheetName = keyof typeof SHEETS
