import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { markdownToText, parseMarkdown, readingMinutes, renderMarkdown, safeHref } from '../../src/lib/markdown'

const html = (src: string) => renderToStaticMarkup(renderMarkdown(src))

describe('markdown subset', () => {
  it('renders headings, paragraphs, bold, italic and links', () => {
    expect(html('## Envíos\n\nTe mandamos el **seguimiento** por *email*.\nApenas sale.')).toBe(
      '<h2>Envíos</h2><p>Te mandamos el <strong>seguimiento</strong> por <em>email</em>. Apenas sale.</p>',
    )
    expect(html('### Sub')).toBe('<h3>Sub</h3>')
    expect(html('# Uno')).toBe('<h2>Uno</h2>') // the page title is the only h1
    expect(html('[Contacto](/contacto) y [web](https://example.com) y [mail](mailto:hola@example.com)')).toBe(
      '<p><a href="/contacto">Contacto</a> y <a href="https://example.com" rel="noopener noreferrer" target="_blank">web</a> y <a href="mailto:hola@example.com">mail</a></p>',
    )
  })

  it('renders ordered and unordered lists and blockquotes', () => {
    expect(html('- uno\n- dos')).toBe('<ul><li>uno</li><li>dos</li></ul>')
    expect(html('1. uno\n2. dos\n   sigue')).toBe('<ol><li>uno</li><li>dos sigue</li></ol>')
    expect(html('3. tres')).toBe('<ol start="3"><li>tres</li></ol>')
    expect(html('> **Borrador.** No publicar.\n> Segunda línea.')).toBe('<blockquote><p><strong>Borrador.</strong> No publicar. Segunda línea.</p></blockquote>')
  })

  it('keeps raw HTML as text', () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('makes javascript: and other unsafe links inert', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '//evil.example', '/\\evil.example']) {
      const out = html(`[clic](${bad})`)
      expect(out, bad).toBe('<p>clic</p>')
    }
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('/productos?necesidad=manchas')).toBe('/productos?necesidad=manchas')
    expect(safeHref('#arriba')).toBe('#arriba')
  })

  it('leaves unmatched marks and snake_case alone, and honours escapes', () => {
    expect(html('2 * 3 = 6 y envio_gratis_desde')).toBe('<p>2 * 3 = 6 y envio_gratis_desde</p>')
    expect(html('\\*no es cursiva\\*')).toBe('<p>*no es cursiva*</p>')
    expect(html('**sin cerrar')).toBe('<p>**sin cerrar</p>')
  })

  it('gives plain text and reading time', () => {
    expect(markdownToText('## Hola\n\n- **uno**\n- [dos](/x)')).toBe('Hola uno dos')
    expect(readingMinutes('palabra '.repeat(600))).toBe(3)
    expect(readingMinutes('')).toBe(1)
    expect(parseMarkdown('')).toEqual([])
  })
})
