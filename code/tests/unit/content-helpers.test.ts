import { describe, expect, it } from 'vitest'
import { csvDate, toCsv } from '../../src/server/services/content/subscribers'
import { fromArgentinaInput, parseAnnouncement, toArgentinaInput } from '../../src/server/services/content/announcements'
import { validateContact } from '../../src/server/services/content/contact'
import { articleJsonLd } from '../../src/server/services/content/article-ld'
import { belowProductSize, formatBytes } from '../../src/server/services/content/media-library'

describe('CSV export', () => {
  it('starts with a BOM, quotes what needs it and neutralises formulas', () => {
    const csv = toCsv(['email', 'nota'], [
      ['ana@example.test', 'con, coma'],
      ['=HYPERLINK("x")', 'dice "hola"\ny sigue'],
      ['@sum', null],
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')).toEqual(['email,nota', 'ana@example.test,"con, coma"', `"'=HYPERLINK(""x"")","dice ""hola""\ny sigue"`, "'@sum,", ''])
  })

  it('writes dates in Buenos Aires time', () => {
    expect(csvDate(new Date('2026-11-23T21:05:00Z'))).toBe('2026-11-23 18:05')
    expect(csvDate(null)).toBe('')
  })
})

describe('announcement dates', () => {
  it('reads and writes the panel input as Buenos Aires time', () => {
    const d = fromArgentinaInput('2026-12-01T09:30')!
    expect(d.toISOString()).toBe('2026-12-01T12:30:00.000Z')
    expect(toArgentinaInput(d)).toBe('2026-12-01T09:30')
    expect(fromArgentinaInput('')).toBeNull()
    expect(parseAnnouncement({ text: 'x', href: '', startsAt: 'mañana', endsAt: '', active: true }).errors.startsAt).toMatch(/no es válida/)
    expect(parseAnnouncement({ text: ' ', href: '', startsAt: '', endsAt: '', active: true }).errors.text).toMatch(/Escribí/)
  })
})

describe('contact validation', () => {
  const base = { reason: 'Otro', name: 'Ana', email: 'ana@example.test', phone: '', orderNumber: '', message: 'Hola, tengo una consulta.' }
  it('accepts a complete message and the listed reasons only', () => {
    expect(validateContact(base, [])).toEqual({})
    expect(validateContact({ ...base, reason: 'Quiero ser embajadora' }, []).reason).toBeDefined()
    expect(validateContact({ ...base, phone: 'llamame' }, []).phone).toBeDefined()
  })
  it('accepts only photos, up to 10 MB', () => {
    expect(validateContact(base, [{ name: 'a.pdf', type: 'application/pdf', data: Buffer.from('x') }]).photos).toMatch(/no es una foto/)
    expect(validateContact(base, [{ name: 'a.jpg', type: 'image/jpeg', data: Buffer.alloc(11 * 1024 * 1024) }]).photos).toMatch(/10 MB/)
  })
})

describe('article structured data', () => {
  it('names the brand as an organization and a reviewer when there is one', () => {
    const ld = articleJsonLd({
      url: 'https://larutinabeauty.com/journal/x',
      headline: 'Título',
      description: 'Bajada',
      image: 'https://larutinabeauty.com/media/public/x.jpg',
      author: '',
      brandName: 'Larutina',
      publisher: 'Larutina Beauty',
      datePublished: new Date('2026-11-01T00:00:00Z'),
      dateModified: new Date('2026-11-02T00:00:00Z'),
      reviewedBy: 'Dra. Ana Pérez, dermatóloga',
    })
    expect(ld).toMatchObject({ '@type': 'Article', author: { '@type': 'Organization', name: 'Larutina' }, reviewedBy: { name: 'Dra. Ana Pérez, dermatóloga' }, image: ['https://larutinabeauty.com/media/public/x.jpg'] })
    expect(articleJsonLd({ ...{ url: 'https://x.test/a', headline: 'h', description: '', image: null, author: 'Meri', brandName: 'Larutina', publisher: 'L', datePublished: new Date(), dateModified: new Date(), reviewedBy: '' } }).author).toEqual({ '@type': 'Person', name: 'Meri' })
  })
})

describe('media library', () => {
  it('flags images too small for a product photo', () => {
    expect(belowProductSize({ width: 1200, height: 800 })).toBe(true)
    expect(belowProductSize({ width: 1600, height: 2000 })).toBe(false)
    expect(belowProductSize({ width: null, height: null })).toBe(false)
    expect(formatBytes(2_500_000)).toBe('2,4 MB')
  })
})
