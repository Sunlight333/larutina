import { emptyFields, mapStrings, normalizeFields, readFields, validateFields, type FieldData, type FieldDef, type Focal, type ImageReader, type ListRow } from './fields'

// The block types of the Home and the landing, institutional and help pages
// (CMS-01). Each type is its field schema (this file) plus a renderer
// (src/components/content/blocks). Every text passes through the copy
// variables (GEN-06) before it is shown, so "{preguntas} preguntas" stays
// right when the diagnosis changes.

const eyebrow: FieldDef = { kind: 'text', name: 'eyebrow', label: 'Etiqueta', help: 'Texto corto sobre el título. Opcional.', max: 60 }
const title = (required = false, label = 'Título'): FieldDef => ({ kind: 'text', name: 'title', label, required, max: 160 })
const text: FieldDef = { kind: 'textarea', name: 'text', label: 'Texto', rows: 3, max: 800 }
const cta = (n = ''): FieldDef[] => [
  { kind: 'text', name: `cta${n}Label`, label: `Botón${n ? ` ${n}` : ''}: texto`, max: 40 },
  { kind: 'link', name: `cta${n}Href`, label: `Botón${n ? ` ${n}` : ''}: link`, help: 'Una página del sitio, como /diagnostico, o una dirección https://' },
]
const images: FieldDef[] = [
  { kind: 'image', name: 'imageDesktop', label: 'Imagen para desktop', help: 'Horizontal, 1920 × 1080 o más.' },
  { kind: 'image', name: 'imageMobile', label: 'Imagen para mobile', help: 'Vertical, 1080 × 1350. En mobile la foto va arriba y el texto abajo: elegí un recorte que no corte la cara.' },
  { kind: 'text', name: 'imageAlt', label: 'Texto alternativo', help: 'Qué se ve en la foto, para quien no la ve. Vacío si es decorativa.', max: 250 },
]

export const BLOCK_DEFS = {
  hero: {
    label: 'Portada (hero)',
    description: 'Título principal, bajada, hasta dos botones y una foto con versión para mobile.',
    fields: [
      eyebrow,
      title(true, 'Título (H1)'),
      { kind: 'textarea', name: 'subtitle', label: 'Bajada', rows: 3, max: 400 },
      ...cta('1'),
      ...cta('2'),
      { kind: 'text', name: 'note', label: 'Texto chico debajo de los botones', max: 120 },
      ...images,
      { kind: 'focal', name: 'focusDesktop', label: 'Punto de interés en desktop', help: 'Qué parte de la foto queda siempre a la vista, en % desde la izquierda y desde arriba.' },
      { kind: 'focal', name: 'focusMobile', label: 'Punto de interés en mobile' },
    ],
  },
  carousel: {
    label: 'Carrusel',
    description: 'Fotos que se deslizan, cada una con texto y link opcional.',
    fields: [
      eyebrow,
      title(),
      {
        kind: 'list',
        name: 'slides',
        label: 'Fotos',
        itemLabel: 'Foto',
        max: 8,
        required: true,
        fields: [
          { kind: 'image', name: 'imageDesktop', label: 'Imagen para desktop', required: true },
          { kind: 'image', name: 'imageMobile', label: 'Imagen para mobile', help: 'Vertical 4:5. Si queda vacía se usa la de desktop.' },
          { kind: 'text', name: 'alt', label: 'Texto alternativo', max: 250 },
          { kind: 'text', name: 'text', label: 'Texto', max: 160 },
          { kind: 'link', name: 'href', label: 'Link' },
        ],
      },
    ],
  },
  features: {
    label: 'Lista de puntos',
    description: 'Propuestas de valor o puntos destacados, con título y texto cada uno.',
    fields: [
      eyebrow,
      title(),
      text,
      {
        kind: 'list',
        name: 'items',
        label: 'Puntos',
        itemLabel: 'Punto',
        max: 8,
        required: true,
        fields: [
          { kind: 'text', name: 'title', label: 'Título', required: true, max: 80 },
          { kind: 'textarea', name: 'text', label: 'Texto', rows: 2, max: 300 },
          { kind: 'image', name: 'image', label: 'Imagen (opcional)' },
        ],
      },
      ...cta(),
    ],
  },
  needs: {
    label: 'Comprar por necesidad',
    description: 'Cards de necesidades con su nombre corto y descripción, que llevan a la página de cada una.',
    fields: [
      eyebrow,
      title(),
      { kind: 'codes', name: 'concernCodes', label: 'Necesidades (códigos, en orden)', help: 'Vacío: el orden de Configuración › Listado.', max: 12 },
      ...cta(),
    ],
  },
  imageText: {
    label: 'Imagen y texto',
    description: 'Una foto con texto al lado y, si querés, productos señalados.',
    fields: [
      eyebrow,
      title(),
      { kind: 'markdown', name: 'body', label: 'Texto', rows: 5 },
      { kind: 'image', name: 'image', label: 'Imagen' },
      { kind: 'text', name: 'imageAlt', label: 'Texto alternativo', max: 250 },
      { kind: 'select', name: 'imageSide', label: 'Imagen a la', options: [{ value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }] },
      { kind: 'codes', name: 'productCodes', label: 'Productos señalados (códigos)', help: 'Opcional. Si un producto se archiva, deja de mostrarse solo.', max: 6 },
      ...cta(),
    ],
  },
  diagnosis: {
    label: 'Diagnóstico',
    description: 'Invitación al diagnóstico: con la vista previa de una pregunta, o como cierre oscuro.',
    fields: [
      { kind: 'select', name: 'variant', label: 'Estilo', options: [{ value: 'preview', label: 'Con vista previa de una pregunta' }, { value: 'dark', label: 'Cierre con fondo oscuro' }] },
      eyebrow,
      title(),
      text,
      { kind: 'text', name: 'ctaLabel', label: 'Botón: texto', max: 40 },
      { kind: 'link', name: 'ctaHref', label: 'Botón: link', help: 'Vacío: /diagnostico.' },
    ],
  },
  routines: {
    label: 'Rutinas armadas',
    description: 'Las rutinas publicadas, con su objetivo y cantidad de pasos. Si no hay ninguna publicada, el bloque no se muestra.',
    fields: [
      eyebrow,
      title(),
      text,
      { kind: 'codes', name: 'routineCodes', label: 'Rutinas (códigos, en orden)', help: 'Vacío: todas las publicadas.', max: 8 },
      ...cta(),
    ],
  },
  featured: {
    label: 'Productos destacados',
    description: 'Grilla de productos publicados. Si ninguno está publicado, el bloque no se muestra.',
    fields: [
      eyebrow,
      title(),
      { kind: 'codes', name: 'productCodes', label: 'Productos (códigos, en orden)', help: 'Vacío: los destacados de Configuración › Listado.', max: 12 },
      ...cta(),
    ],
  },
  howItWorks: {
    label: 'Cómo funciona',
    description: 'Pasos numerados.',
    fields: [
      eyebrow,
      title(),
      text,
      {
        kind: 'list',
        name: 'steps',
        label: 'Pasos',
        itemLabel: 'Paso',
        max: 6,
        required: true,
        fields: [
          { kind: 'text', name: 'title', label: 'Título', required: true, max: 80 },
          { kind: 'textarea', name: 'text', label: 'Texto', rows: 2, max: 400 },
        ],
      },
      ...cta(),
    ],
  },
  richText: {
    label: 'Texto',
    description: 'Un texto con títulos, listas y links.',
    fields: [eyebrow, title(), { kind: 'markdown', name: 'body', label: 'Texto', required: true, rows: 8 }],
  },
  faq: {
    label: 'Preguntas frecuentes',
    description: 'Preguntas y respuestas desplegables. Se publican con datos estructurados para Google.',
    fields: [
      title(),
      {
        kind: 'list',
        name: 'items',
        label: 'Preguntas',
        itemLabel: 'Pregunta',
        max: 30,
        required: true,
        fields: [
          { kind: 'text', name: 'question', label: 'Pregunta', required: true, max: 200 },
          { kind: 'markdown', name: 'answer', label: 'Respuesta', required: true, rows: 3 },
        ],
      },
    ],
  },
  testimonials: {
    label: 'Testimonios',
    description: 'Solo testimonios reales, con permiso de quien los dio.',
    fields: [
      eyebrow,
      title(),
      {
        kind: 'list',
        name: 'items',
        label: 'Testimonios',
        itemLabel: 'Testimonio',
        max: 9,
        required: true,
        fields: [
          { kind: 'textarea', name: 'quote', label: 'Testimonio', required: true, rows: 3, max: 600 },
          { kind: 'text', name: 'name', label: 'Nombre', required: true, max: 80 },
          { kind: 'text', name: 'detail', label: 'Detalle', help: 'Por ejemplo: piel mixta, 34 años.', max: 80 },
        ],
      },
    ],
  },
  ambassadors: {
    label: 'Embajadoras',
    description: 'Presenta el programa de embajadoras. Se apaga hasta que el programa esté definido.',
    fields: [eyebrow, title(true), text, { kind: 'image', name: 'image', label: 'Imagen' }, { kind: 'text', name: 'imageAlt', label: 'Texto alternativo', max: 250 }, ...cta()],
  },
  brands: {
    label: 'Marcas',
    description: 'Logos (o nombres) de las marcas con productos publicados.',
    fields: [eyebrow, title(), ...cta()],
  },
  newsletter: {
    label: 'Newsletter',
    description: 'Suscripción al newsletter con consentimiento. Vacío: los textos de Configuración › Textos generales.',
    fields: [title(), text],
  },
} satisfies Record<string, { label: string; description: string; fields: FieldDef[] }>

export type BlockType = keyof typeof BLOCK_DEFS
export const BLOCK_TYPES = Object.keys(BLOCK_DEFS) as BlockType[]
export const isBlockType = (t: unknown): t is BlockType => typeof t === 'string' && t in BLOCK_DEFS

// What each renderer receives once the stored data is normalized.
type Cta = { ctaLabel: string; ctaHref: string }
export type BlockDataMap = {
  hero: { eyebrow: string; title: string; subtitle: string; cta1Label: string; cta1Href: string; cta2Label: string; cta2Href: string; note: string; imageDesktop: string; imageMobile: string; imageAlt: string; focusDesktop: Focal; focusMobile: Focal }
  carousel: { eyebrow: string; title: string; slides: (ListRow & { imageDesktop: string; imageMobile: string; alt: string; text: string; href: string })[] }
  features: { eyebrow: string; title: string; text: string; items: (ListRow & { title: string; text: string; image: string })[] } & Cta
  needs: { eyebrow: string; title: string; concernCodes: string[] } & Cta
  imageText: { eyebrow: string; title: string; body: string; image: string; imageAlt: string; imageSide: 'left' | 'right'; productCodes: string[] } & Cta
  diagnosis: { variant: 'preview' | 'dark'; eyebrow: string; title: string; text: string } & Cta
  routines: { eyebrow: string; title: string; text: string; routineCodes: string[] } & Cta
  featured: { eyebrow: string; title: string; productCodes: string[] } & Cta
  howItWorks: { eyebrow: string; title: string; text: string; steps: (ListRow & { title: string; text: string })[] } & Cta
  richText: { eyebrow: string; title: string; body: string }
  faq: { title: string; items: (ListRow & { question: string; answer: string })[] }
  testimonials: { eyebrow: string; title: string; items: (ListRow & { quote: string; name: string; detail: string })[] }
  ambassadors: { eyebrow: string; title: string; text: string; image: string; imageAlt: string } & Cta
  brands: { eyebrow: string; title: string } & Cta
  newsletter: { title: string; text: string }
}

export type Block<T extends BlockType = BlockType> = { [K in T]: { id: string; type: K; enabled: boolean; data: BlockDataMap[K] } }[T]

/** The panel-edited document of a page: what `draft` and `published` hold (03 §1.4). */
export type PageDoc = { title: string; seoTitle: string; seoDescription: string; blocks: Block[] }

const BLOCK_ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export function normalizeBlock(raw: unknown, index = 0): Block | null {
  const b = (raw ?? {}) as { id?: unknown; type?: unknown; enabled?: unknown; data?: unknown }
  if (!isBlockType(b.type)) return null
  const id = typeof b.id === 'string' && BLOCK_ID_RE.test(b.id) ? b.id : `b${index}`
  return { id, type: b.type, enabled: b.enabled !== false, data: normalizeFields(BLOCK_DEFS[b.type].fields, b.data) } as Block
}

/** A stored page document, coerced to the current shape (unknown block types are dropped). */
export function normalizePageDoc(raw: unknown, fallbackTitle = ''): PageDoc {
  const d = (raw ?? {}) as Record<string, unknown>
  const blocks = Array.isArray(d.blocks) ? d.blocks.map(normalizeBlock).filter((b): b is Block => b !== null) : []
  return {
    title: typeof d.title === 'string' && d.title ? d.title : fallbackTitle,
    seoTitle: typeof d.seoTitle === 'string' ? d.seoTitle : '',
    seoDescription: typeof d.seoDescription === 'string' ? d.seoDescription : '',
    blocks,
  }
}

export function newBlock<T extends BlockType>(type: T, id: string, data: Partial<BlockDataMap[T]> = {}, enabled = true): Block<T> {
  return { id, type, enabled, data: normalizeFields(BLOCK_DEFS[type].fields, { ...emptyFields(BLOCK_DEFS[type].fields), ...data }) } as unknown as Block<T>
}

export function blockLabel(type: BlockType) {
  return BLOCK_DEFS[type].label
}

/**
 * Reads the block editor from a submitted form: `blocks` holds the order,
 * type and on/off of each block as JSON; fields are `b.<id>.<field>`.
 * Returns the blocks and the problems keyed by input name.
 */
export async function readBlocksForm(form: FormData, readImage: ImageReader): Promise<{ blocks: Block[]; errors: Record<string, string>; invalid: string[] }> {
  const errors: Record<string, string> = {}
  let structure: unknown
  try {
    structure = JSON.parse(String(form.get('blocks') ?? '[]'))
  } catch {
    structure = null
  }
  if (!Array.isArray(structure)) return { blocks: [], errors: { blocks: 'Los bloques no se pudieron leer. Recargá la página.' }, invalid: [] }
  const blocks: Block[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const [i, s] of structure.entries()) {
    const item = (s ?? {}) as { id?: unknown; type?: unknown; enabled?: unknown }
    if (!isBlockType(item.type) || typeof item.id !== 'string' || !BLOCK_ID_RE.test(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    const def = BLOCK_DEFS[item.type]
    const prefix = `b.${item.id}`
    const before = Object.keys(errors).length
    const data = await readFields(form, def.fields, prefix, readImage, errors)
    validateFields(def.fields, data, prefix, errors, item.enabled !== false)
    if (Object.keys(errors).length > before) {
      // Opens the block in the editor and names it in the summary.
      errors[prefix] = 'Este bloque tiene campos para revisar.'
      invalid.push(`${def.label} (bloque ${i + 1})`)
    }
    blocks.push({ id: item.id, type: item.type, enabled: item.enabled !== false, data: normalizeFields(def.fields, data) } as Block)
  }
  return { blocks, errors, invalid }
}

/** Fills the copy variables in every text of the enabled blocks. */
export function fillBlocks(blocks: Block[], fill: (s: string) => string): Block[] {
  return blocks.filter((b) => b.enabled).map((b) => ({ ...b, data: mapStrings(b.data, fill) }) as Block)
}

/** Data for the client-side editor: the schema of each type and an empty block of it. */
export function blockCatalog() {
  return BLOCK_TYPES.map((type) => ({ type, label: BLOCK_DEFS[type].label, description: BLOCK_DEFS[type].description, fields: BLOCK_DEFS[type].fields as FieldDef[], empty: emptyFields(BLOCK_DEFS[type].fields) as FieldData }))
}
export type BlockCatalog = ReturnType<typeof blockCatalog>
