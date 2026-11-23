import { createElement, Fragment, type ReactNode } from 'react'

// The small Markdown the panel accepts in rich texts, articles and legal
// documents: ## and ### headings, paragraphs, **bold**, *italic*, links,
// lists and blockquotes. It is parsed into a tree and rendered as React
// elements, so raw HTML is only ever text and a link is kept only when it
// points to http(s), mailto or a path of the site. Nothing else is needed for
// the copy in the content file, and a short list is easy to keep safe.

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'link'; href: string | null; children: Inline[] }

export type MdBlock =
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { type: 'blockquote'; children: MdBlock[] }

/** A link target the site may render: http(s), mailto, or a path or anchor of the site. */
export function safeHref(raw: string): string | null {
  // Browsers ignore tabs, newlines and leading control characters inside a
  // URL ("java\tscript:"), so they are removed before checking the scheme.
  // eslint-disable-next-line no-control-regex
  const href = raw.replace(/[\u0000- \u007f]/g, '')
  if (/^https?:\/\/[^/]/i.test(href)) return href
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return href
  if (/^\/(?![/\\])/.test(href)) return href // a path of the site, not "//host"
  if (/^#[\w-]*$/.test(href)) return href
  return null
}

const UL = /^\s{0,3}[-*+]\s+(.*)$/
const OL = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const QUOTE = /^\s{0,3}>\s?(.*)$/

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      // The page title is the only h1, so "#" becomes a section heading too.
      const level = heading[1]!.length <= 2 ? 2 : 3
      blocks.push({ type: 'heading', level, children: parseInline(heading[2]!) })
      i++
      continue
    }
    if (QUOTE.test(line)) {
      const inner: string[] = []
      for (let m = QUOTE.exec(lines[i] ?? ''); m; m = QUOTE.exec(lines[i] ?? '')) {
        inner.push(m[1]!)
        i++
      }
      blocks.push({ type: 'blockquote', children: parseMarkdown(inner.join('\n')) })
      continue
    }
    const ul = UL.exec(line)
    const ol = OL.exec(line)
    if (ul || ol) {
      const ordered = !ul
      const start = ol ? Number(ol[1]) : 1
      const items: string[] = []
      while (i < lines.length) {
        const l = lines[i]!
        const m = ordered ? OL.exec(l) : UL.exec(l)
        if (m) {
          items.push(ordered ? m[2]! : m[1]!)
          i++
        } else if (l.trim() && /^\s{2,}\S/.test(l) && items.length) {
          // An indented line continues the previous item.
          items[items.length - 1] += ` ${l.trim()}`
          i++
        } else break
      }
      blocks.push({ type: 'list', ordered, start, items: items.map(parseInline) })
      continue
    }
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i]!
      if (!l.trim() || HEADING.test(l) || QUOTE.test(l) || UL.test(l) || OL.test(l)) break
      para.push(l.trim())
      i++
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) })
  }
  return blocks
}

/** Inline marks: **bold**, *italic* or _italic_, [text](href), and \ escapes. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => {
    if (text) out.push({ type: 'text', value: text })
    text = ''
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === '\\' && i + 1 < src.length && /[\\*_[\]()#>`-]/.test(src[i + 1]!)) {
      text += src[i + 1]
      i += 2
      continue
    }
    if (c === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'strong', children: parseInline(src.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    if ((c === '*' || c === '_') && src[i + 1] !== c && src[i + 1] !== ' ' && src[i + 1] !== undefined) {
      // "_" only opens at a word start, so snake_case text stays as is.
      const opens = c === '*' || i === 0 || /[\s(]/.test(src[i - 1]!)
      const end = findClosing(src, c, i + 1)
      if (opens && end > i + 1) {
        flush()
        out.push({ type: 'em', children: parseInline(src.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    if (c === '[') {
      const close = matchingBracket(src, i)
      if (close > i && src[close + 1] === '(') {
        const end = matchingBracket(src, close + 1, '(', ')')
        if (end > close + 1) {
          flush()
          const target = src.slice(close + 2, end).trim().split(/\s+/)[0] ?? ''
          out.push({ type: 'link', href: safeHref(target), children: parseInline(src.slice(i + 1, close)) })
          i = end + 1
          continue
        }
      }
    }
    text += c
    i++
  }
  flush()
  return out
}

function findClosing(src: string, mark: string, from: number): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\') {
      j++
      continue
    }
    if (src[j] === mark && src[j - 1] !== ' ' && src[j + 1] !== mark) {
      if (mark === '_' && j + 1 < src.length && /\w/.test(src[j + 1]!)) continue
      return j
    }
  }
  return -1
}

function matchingBracket(src: string, open: number, openChar = '[', closeChar = ']'): number {
  let depth = 0
  for (let j = open; j < src.length; j++) {
    if (src[j] === '\\') {
      j++
      continue
    }
    if (src[j] === openChar) depth++
    else if (src[j] === closeChar && --depth === 0) return j
  }
  return -1
}

// ---------------------------------------------------------------- render ----

export type MarkdownOptions = {
  /** Classes per element, so each place can style the same tree its own way. */
  className?: Partial<Record<'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'li' | 'blockquote' | 'a', string>>
}

function renderInline(nodes: Inline[], opts: MarkdownOptions, keyPrefix: string): ReactNode[] {
  return nodes.map((n, k) => {
    const key = `${keyPrefix}.${k}`
    switch (n.type) {
      case 'text':
        return n.value
      case 'strong':
        return createElement('strong', { key }, ...renderInline(n.children, opts, key))
      case 'em':
        return createElement('em', { key }, ...renderInline(n.children, opts, key))
      case 'link': {
        const children = renderInline(n.children, opts, key)
        if (!n.href) return createElement(Fragment, { key }, ...children)
        const external = /^https?:/i.test(n.href)
        return createElement(
          'a',
          { key, href: n.href, className: opts.className?.a, ...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {}) },
          ...children,
        )
      }
    }
  })
}

function renderBlocks(blocks: MdBlock[], opts: MarkdownOptions, keyPrefix: string): ReactNode[] {
  const cls = opts.className ?? {}
  return blocks.map((b, k) => {
    const key = `${keyPrefix}${k}`
    switch (b.type) {
      case 'heading':
        return createElement(b.level === 2 ? 'h2' : 'h3', { key, className: b.level === 2 ? cls.h2 : cls.h3 }, ...renderInline(b.children, opts, key))
      case 'paragraph':
        return createElement('p', { key, className: cls.p }, ...renderInline(b.children, opts, key))
      case 'list':
        return createElement(
          b.ordered ? 'ol' : 'ul',
          { key, className: b.ordered ? cls.ol : cls.ul, ...(b.ordered && b.start !== 1 ? { start: b.start } : {}) },
          ...b.items.map((item, j) => createElement('li', { key: `${key}.${j}`, className: cls.li }, ...renderInline(item, opts, `${key}.${j}`))),
        )
      case 'blockquote':
        return createElement('blockquote', { key, className: cls.blockquote }, ...renderBlocks(b.children, opts, `${key}.`))
    }
  })
}

/** Markdown as React elements; never HTML. */
export function renderMarkdown(source: string, opts: MarkdownOptions = {}): ReactNode {
  return createElement(Fragment, null, ...renderBlocks(parseMarkdown(source), opts, 'md'))
}

/** Plain text of a Markdown source, for descriptions and reading time. */
export function markdownToText(source: string): string {
  const inline = (nodes: Inline[]): string => nodes.map((n) => (n.type === 'text' ? n.value : inline(n.children))).join('')
  const block = (b: MdBlock): string =>
    b.type === 'list' ? b.items.map(inline).join(' ') : b.type === 'blockquote' ? b.children.map(block).join(' ') : inline(b.children)
  return parseMarkdown(source).map(block).join(' ').replace(/\s+/g, ' ').trim()
}

/** Minutes to read at about 200 words a minute; at least 1. */
export function readingMinutes(source: string): number {
  const words = markdownToText(source).split(' ').filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
