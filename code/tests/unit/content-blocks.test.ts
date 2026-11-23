import { describe, expect, it } from 'vitest'
import { BLOCK_DEFS, BLOCK_TYPES, fillBlocks, normalizePageDoc, readBlocksForm, type Block } from '../../src/server/services/content/blocks'
import { linkProblem, mapStrings, stableStringify, validateFields } from '../../src/server/services/content/fields'
import { slugify, slugProblem } from '../../src/server/services/content/pages'
import { SEED_ANNOUNCEMENTS, SEED_ARTICLE_CATEGORIES, SEED_LEGAL, SEED_PAGES } from '../../src/server/services/content/seed-data'

const keepKey = async (name: string) => '' + name.length // not used for these blocks

function form(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.append(k, v)
  return f
}

describe('page slugs', () => {
  it('accepts kebab-case and refuses reserved routes', () => {
    expect(slugProblem('cuidado-de-verano')).toBeNull()
    expect(slugProblem('Verano')).toMatch(/minúsculas/)
    expect(slugProblem('verano--2')).toMatch(/minúsculas/)
    expect(slugProblem('-verano')).toMatch(/minúsculas/)
    for (const r of ['productos', 'journal', 'legales', 'contacto', 'admin', 'inicio', 'vista-previa', 'arrepentimiento']) expect(slugProblem(r), r).toMatch(/ya es una sección/)
    expect(slugProblem('')).toMatch(/Escribí/)
    expect(slugify('Cuidado de Verano: ¡Sérum!')).toBe('cuidado-de-verano-serum')
  })
})

describe('block form', () => {
  it('reads order, on/off and fields, with list rows in their order', async () => {
    const f = form({
      blocks: JSON.stringify([
        { id: 'a', type: 'howItWorks', enabled: true },
        { id: 'b', type: 'richText', enabled: false },
      ]),
      'b.a.title': 'Cómo funciona',
      'b.a.steps': JSON.stringify(['y', 'x']),
      'b.a.steps.x.title': 'Segundo',
      'b.a.steps.y.title': 'Primero',
      'b.a.ctaHref': '/diagnostico',
      'b.b.body': '',
    })
    const { blocks, errors } = await readBlocksForm(f, keepKey)
    expect(errors).toEqual({})
    expect(blocks.map((b) => [b.id, b.type, b.enabled])).toEqual([
      ['a', 'howItWorks', true],
      ['b', 'richText', false],
    ])
    const steps = (blocks[0] as Block<'howItWorks'>).data.steps
    expect(steps.map((s) => [s._id, s.title])).toEqual([
      ['y', 'Primero'],
      ['x', 'Segundo'],
    ])
  })

  it('reports problems by input name, and skips required checks on hidden blocks', async () => {
    const f = form({
      blocks: JSON.stringify([
        { id: 'h', type: 'hero', enabled: true },
        { id: 'r', type: 'richText', enabled: false },
        { id: 'z', type: 'unknown', enabled: true },
      ]),
      'b.h.title': '',
      'b.h.cta1Href': 'javascript:alert(1)',
      'b.h.focusDesktop.x': '150',
      'b.r.body': '',
    })
    const { blocks, errors, invalid } = await readBlocksForm(f, async () => '')
    expect(blocks).toHaveLength(2)
    expect(errors['b.h.title']).toBe('Completá este campo.')
    expect(errors['b.h.cta1Href']).toMatch(/empezar con \//)
    expect(errors['b.h.focusDesktop.x']).toMatch(/0 a 100/)
    expect(errors['b.h']).toBeDefined()
    expect(errors['b.r.body']).toBeUndefined()
    expect(invalid).toEqual(['Portada (hero) (bloque 1)'])
  })

  it('shows upload problems next to the image field', async () => {
    const f = form({ blocks: JSON.stringify([{ id: 'c', type: 'ambassadors', enabled: false }]), 'b.c.image': 'public/old.jpg' })
    const { errors, blocks } = await readBlocksForm(f, async () => ({ error: '"x.gif": el formato no es válido.' }))
    expect(errors['b.c.image']).toMatch(/formato/)
    expect((blocks[0] as Block<'ambassadors'>).data.image).toBe('public/old.jpg')
  })

  it('checks links and codes', () => {
    expect(linkProblem('/productos')).toBeNull()
    expect(linkProblem('https://larutinabeauty.com')).toBeNull()
    expect(linkProblem('mailto:hola@larutina.com')).toBeNull()
    expect(linkProblem('productos')).not.toBeNull()
    expect(linkProblem('//evil.example')).not.toBeNull()
    const errors: Record<string, string> = {}
    validateFields(BLOCK_DEFS.featured.fields, { eyebrow: '', title: '', productCodes: ['ok-1', 'Mal Código'], ctaLabel: '', ctaHref: '' }, 'p', errors)
    expect(errors['p.productCodes']).toMatch(/no es un código válido/)
  })

  it('normalizes stored documents and drops unknown blocks', () => {
    const doc = normalizePageDoc({ title: 'X', blocks: [{ id: 'a', type: 'hero', data: { title: 'Hola', focusDesktop: { x: 500, y: 'no' } } }, { type: 'gone' }] })
    expect(doc.blocks).toHaveLength(1)
    const hero = doc.blocks[0] as Block<'hero'>
    expect(hero.enabled).toBe(true)
    expect(hero.data.focusDesktop).toEqual({ x: 100, y: 50 })
    expect(hero.data.subtitle).toBe('')
  })

  it('fills copy variables in visible blocks only', () => {
    const doc = SEED_PAGES[0]!.doc
    const filled = fillBlocks(doc.blocks, (s) => s.replaceAll('{preguntas}', '8'))
    expect(filled.every((b) => b.enabled)).toBe(true)
    expect(JSON.stringify(filled)).not.toContain('{preguntas}')
    expect(mapStrings({ _id: '{x}', a: ['{x}'] }, () => 'y')).toEqual({ _id: '{x}', a: ['y'] })
  })

  it('compares documents regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(stableStringify({ a: [{ c: 2, d: 1 }], b: 1 }))
  })

  it('has a renderer-facing definition for every type', () => {
    expect(BLOCK_TYPES.length).toBe(15)
    for (const t of BLOCK_TYPES) expect(BLOCK_DEFS[t].fields.length, t).toBeGreaterThan(0)
  })
})

describe('seed content', () => {
  const allText = JSON.stringify([SEED_PAGES, SEED_LEGAL, SEED_ANNOUNCEMENTS, SEED_ARTICLE_CATEGORIES])

  it('applies the 21/11 copy fixes: Carrito, not bolsa; Tónico, not toner (plan step 7)', () => {
    expect(allText).not.toMatch(/\bbolsa\b/i)
    expect(allText).not.toMatch(/\btoners?\b/i)
    expect(allText).toMatch(/carrito/)
    expect(allText).toMatch(/tónico/)
  })

  it('writes counts as variables, never by hand (GEN-06)', () => {
    expect(allText).not.toMatch(/\b(ocho|cuatro) (preguntas|rutinas|combinaciones)/i)
    expect(allText).toContain('{preguntas} preguntas')
    expect(allText).toContain('{rutinas} combinaciones')
  })

  it('stores pages that pass the editor validation, and keeps the visible ones free of pending markers', () => {
    for (const p of SEED_PAGES) {
      expect(slugProblem(p.slug) === null || p.slug === 'inicio', p.slug).toBe(true)
      expect(stableStringify(normalizePageDoc(JSON.parse(JSON.stringify(p.doc))))).toBe(stableStringify(p.doc))
      for (const b of p.doc.blocks) {
        const errors: Record<string, string> = {}
        validateFields(BLOCK_DEFS[b.type].fields, b.data, b.id, errors, b.enabled)
        expect(errors, `${p.slug}/${b.id}`).toEqual({})
        if (b.enabled) expect(JSON.stringify(b.data), `${p.slug}/${b.id}`).not.toMatch(/\[(PENDIENTE|X a X|X\]|Dra\.)|\bX días/)
      }
    }
  })

  it('marks every legal draft as pending legal review', () => {
    expect(Object.keys(SEED_LEGAL).sort()).toEqual(['cambios-y-devoluciones', 'cookies', 'privacidad', 'programa-embajadoras', 'terminos'])
    for (const body of Object.values(SEED_LEGAL)) expect(body).toMatch(/^> \*\*Borrador pendiente de revisión legal\.\*\*/)
  })
})
