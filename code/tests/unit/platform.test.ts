import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, codeAt, verifyTotp } from '../../src/server/auth/totp'
import { hashPassword, passwordProblem, verifyPassword } from '../../src/server/auth/password'
import { can } from '../../src/server/auth/permissions'
import { rateLimit } from '../../src/server/rate-limit'
import { fillVariables } from '../../src/lib/copy-variables'
import { defaultSettings, SETTINGS } from '../../src/server/settings/registry'
import { safeFileName } from '../../src/server/media'
import { LocalDiskStorage } from '../../src/server/storage'
import { moneyCents } from '../../src/server/admin/forms'

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 appendix B, SHA-1 seed "12345678901234567890"; 6-digit truncation of 94287082.
  const secret = base32Encode(Buffer.from('12345678901234567890'))

  it('round-trips base32', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(base32Decode(secret).toString()).toBe('12345678901234567890')
  })

  it('matches the RFC test vector', () => {
    expect(codeAt(secret, Math.floor(59 / 30))).toBe('287082')
    expect(codeAt(secret, Math.floor(1111111109 / 30))).toBe('081804')
  })

  it('accepts one step of drift and never the same step twice', () => {
    const now = 1111111109_000
    const step = Math.floor(now / 30_000)
    expect(verifyTotp(secret, '081804', null, now)).toBe(step)
    expect(verifyTotp(secret, '081804', step, now)).toBeNull()
    expect(verifyTotp(secret, codeAt(secret, step + 1), null, now)).toBe(step + 1)
    expect(verifyTotp(secret, codeAt(secret, step + 3), null, now)).toBeNull()
    expect(verifyTotp(secret, '12345', null, now)).toBeNull()
  })
})

describe('passwords and roles', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('una contraseña larga')
    const b = await hashPassword('una contraseña larga')
    expect(a).not.toBe(b)
    expect(await verifyPassword('una contraseña larga', a)).toBe(true)
    expect(await verifyPassword('otra', a)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
    expect(passwordProblem('corta')).toMatch(/12/)
  })

  it('gives each role only what it needs (ADM-01)', () => {
    expect(can('ADMIN', 'catalog.cost')).toBe(true)
    expect(can('CATALOG', 'catalog.cost')).toBe(false)
    expect(can('CATALOG', 'catalog.import')).toBe(true)
    expect(can('CONTENT', 'catalog.edit')).toBe(false)
    expect(can('SUPPORT', 'messages.view')).toBe(true)
    expect(can('SUPPORT', 'users.manage')).toBe(false)
  })
})

describe('rate limit', () => {
  it('blocks after the limit within the window and resets after it', () => {
    const key = `t-${Math.random()}`
    expect(rateLimit(key, 2, 1000, 0).ok).toBe(true)
    expect(rateLimit(key, 2, 1000, 10).ok).toBe(true)
    expect(rateLimit(key, 2, 1000, 20).ok).toBe(false)
    expect(rateLimit(key, 2, 1000, 1001).ok).toBe(true)
  })
})

describe('settings and copy', () => {
  it('has unique keys and the launch defaults (03 §4)', () => {
    const keys = SETTINGS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    const d = defaultSettings()
    expect(d['site.waitlistMode']).toBe(true)
    expect(d['site.maintenanceMode']).toBe(false)
    expect(d['catalog.vatRate']).toBe(21)
    expect(d['navigation.menu'].find((m) => m.highlight)?.label).toBe('Diagnóstico')
  })

  it('fills copy variables and leaves unknown ones visible (GEN-06)', () => {
    expect(fillVariables('Más de {productos} productos de {marcas} marcas', { productos: 15, marcas: 3 })).toBe('Más de 15 productos de 3 marcas')
    expect(fillVariables('Hola {desconocida}', {})).toBe('Hola {desconocida}')
  })

  it('reads money in pesos as centavos and rejects a thousands dot', () => {
    const f = new FormData()
    f.set('a', '18900')
    f.set('b', '18.900')
    f.set('c', '99,5')
    expect(moneyCents(f, 'a')).toBe(1_890_000)
    expect(moneyCents(f, 'b')).toBeNaN() // thousands dot: ambiguous, rejected like the importer does
    expect(moneyCents(f, 'c')).toBe(9950)
  })
})

describe('storage', () => {
  it('makes safe file names and refuses keys outside its root', async () => {
    expect(safeFileName('Sérum Ñandú (1).JPG')).toBe('Serum-Nandu-1-.JPG')
    const s = new LocalDiskStorage(`${process.env.TEMP ?? '/tmp'}/larutina-storage-test`)
    await s.put('public/a/b.txt', Buffer.from('hola'), 'text/plain')
    expect((await s.get('public/a/b.txt'))?.toString()).toBe('hola')
    expect(await s.get('public/none.txt')).toBeNull()
    await expect(s.get('../escape.txt')).rejects.toThrow()
  })
})
