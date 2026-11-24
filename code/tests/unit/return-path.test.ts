// After signing in she goes back only to a page of this site (no open redirect).
import { describe, expect, it } from 'vitest'
import { safeReturnPath, signInHref } from '../../src/lib/return-path'

describe('safeReturnPath', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeReturnPath('/producto/ma-serum')).toBe('/producto/ma-serum')
    expect(safeReturnPath('/cuenta/pedidos?x=1#a')).toBe('/cuenta/pedidos?x=1#a')
  })

  it('refuses other sites and odd forms', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'evil.com', 'javascript:alert(1)', '/a\nb', '', null, 42]) {
      expect(safeReturnPath(bad)).toBe('/cuenta')
    }
  })

  it('never returns to the sign-in screens themselves', () => {
    expect(safeReturnPath('/cuenta/ingresar?volver=/x')).toBe('/cuenta')
    expect(safeReturnPath('/cuenta/nueva-contrasena?t=abc', '/')).toBe('/')
  })

  it('builds the sign-in link that saves the product on return', () => {
    expect(signInHref('/producto/ma-serum', { save: 'ma-serum' })).toBe('/cuenta/ingresar?volver=%2Fproducto%2Fma-serum&guardar=ma-serum')
  })
})
