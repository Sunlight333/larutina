// One base template with the brand's look (EM-00, EML-01): paper background,
// ink text, the terracotta accent, the logo, and the footer of the content
// file. The body is the panel's Markdown subset, rendered here to escaped
// HTML (email clients need plain tables and inline styles, not React), plus a
// plain-text version. Values from variables are always escaped.
import { fillVariables, type CopyVariables } from '@/lib/copy-variables'
import { parseMarkdown, safeHref, type Inline, type MdBlock } from '@/lib/markdown'
import { formatARS } from '@/lib/money'

export type EmailDetailLine = { name: string; brand: string; size: string; quantity: number; totalCents: number }
export type EmailDetail = { lines: EmailDetailLine[]; subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number }
export type EmailBank = { holder: string; cuit: string; bank: string; cbu: string; alias: string }

export type EmailContent = { subject: string; preheader: string; body: string; ctaLabel: string; marketing?: boolean }

export type EmailFrame = {
  siteUrl: string
  brandName: string
  brandFullName: string
  legalName: string
  logoUrl: string
  whatsappUrl: string | null
  ctaUrl: string | null
  unsubscribeUrl?: string | null
}

const C = { paper: '#fbf9f6', shell: '#f4f0ea', line: '#e6e0d8', ink: '#2b2622', soft: '#4e4741', muted: '#6e665f', accent: '#c97f63', accentInk: '#9a4f33' }
const FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif"

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return escapeHtml(n.value)
      if (n.type === 'strong') return `<strong>${inlineHtml(n.children)}</strong>`
      if (n.type === 'em') return `<em>${inlineHtml(n.children)}</em>`
      const href = n.href ? safeHref(n.href) : null
      return href ? `<a href="${escapeHtml(href)}" style="color:${C.accentInk};text-decoration:underline">${inlineHtml(n.children)}</a>` : inlineHtml(n.children)
    })
    .join('')
}

function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.value : n.type === 'link' && n.href ? `${inlineText(n.children)} (${n.href})` : inlineText(n.children))).join('')
}

const P = `margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.soft}`

function blocksHtml(blocks: MdBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'heading') return `<h${b.level} style="margin:24px 0 8px;font-size:${b.level === 2 ? 20 : 17}px;color:${C.ink}">${inlineHtml(b.children)}</h${b.level}>`
      if (b.type === 'paragraph') return `<p style="${P}">${inlineHtml(b.children)}</p>`
      if (b.type === 'list') {
        const tag = b.ordered ? 'ol' : 'ul'
        return `<${tag} style="margin:0 0 16px;padding-left:22px;color:${C.soft};font-size:16px;line-height:1.6">${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${tag}>`
      }
      return `<blockquote style="margin:0 0 16px;padding-left:14px;border-left:3px solid ${C.accent}">${blocksHtml(b.children)}</blockquote>`
    })
    .join('')
}

function blocksText(blocks: MdBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'heading' || b.type === 'paragraph') return inlineText(b.children)
      if (b.type === 'list') return b.items.map((i, k) => `${b.ordered ? `${b.start + k}.` : '-'} ${inlineText(i)}`).join('\n')
      return blocksText(b.children)
    })
    .join('\n\n')
}

function detailHtml(d: EmailDetail): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:15px;color:${strong ? C.ink : C.muted};${strong ? 'font-weight:700' : ''}">${label}</td><td align="right" style="padding:4px 0;font-size:15px;color:${C.ink};${strong ? 'font-weight:700' : ''}">${value}</td></tr>`
  const lines = d.lines
    .map(
      (l) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;color:${C.ink}"><strong>${escapeHtml(l.name)}</strong><br><span style="color:${C.muted};font-size:13px">${escapeHtml(l.brand)} · ${escapeHtml(l.size)} · ${l.quantity} u.</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;color:${C.ink};white-space:nowrap">${formatARS(l.totalCents)}</td></tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:collapse">${lines}${row('Subtotal', formatARS(d.subtotalCents))}${d.discountCents ? row('Descuentos', `−${formatARS(d.discountCents)}`) : ''}${row('Envío', d.shippingCents ? formatARS(d.shippingCents) : 'Gratis')}${row('Total', formatARS(d.totalCents), true)}</table>`
}

function detailText(d: EmailDetail): string {
  return [
    ...d.lines.map((l) => `${l.quantity} × ${l.name} (${l.brand}, ${l.size}): ${formatARS(l.totalCents)}`),
    `Subtotal: ${formatARS(d.subtotalCents)}`,
    ...(d.discountCents ? [`Descuentos: −${formatARS(d.discountCents)}`] : []),
    `Envío: ${d.shippingCents ? formatARS(d.shippingCents) : 'Gratis'}`,
    `Total: ${formatARS(d.totalCents)}`,
  ].join('\n')
}

function bankHtml(b: EmailBank): string {
  const row = (k: string, v: string) => (v ? `<tr><td style="padding:3px 12px 3px 0;color:${C.muted};font-size:15px">${k}</td><td style="padding:3px 0;color:${C.ink};font-size:15px;font-weight:700">${escapeHtml(v)}</td></tr>` : '')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:${C.shell};border-radius:14px;padding:14px 18px;border-collapse:separate">${row('Titular', b.holder)}${row('CUIT', b.cuit)}${row('Banco', b.bank)}${row('CBU', b.cbu)}${row('Alias', b.alias)}</table>`
}

function bankText(b: EmailBank): string {
  return [['Titular', b.holder], ['CUIT', b.cuit], ['Banco', b.bank], ['CBU', b.cbu], ['Alias', b.alias]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
}

export function renderEmail(content: EmailContent, vars: CopyVariables, frame: EmailFrame, blocks: { detalle?: EmailDetail; datos_bancarios?: EmailBank } = {}) {
  const fill = (s: string) => fillVariables(s, vars)
  const subject = fill(content.subject).replace(/\s+/g, ' ').trim()
  const preheader = fill(content.preheader)

  // Split the body at the block placeholders so they render as blocks, not text.
  const parts = fill(content.body).split(/^\s*\{(detalle|datos_bancarios)\}\s*$/m)
  let bodyHtml = ''
  let bodyText = ''
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      if (part === 'detalle' && blocks.detalle) {
        bodyHtml += detailHtml(blocks.detalle)
        bodyText += `\n\n${detailText(blocks.detalle)}\n\n`
      }
      if (part === 'datos_bancarios' && blocks.datos_bancarios) {
        bodyHtml += bankHtml(blocks.datos_bancarios)
        bodyText += `\n\n${bankText(blocks.datos_bancarios)}\n\n`
      }
      return
    }
    const md = parseMarkdown(part)
    bodyHtml += blocksHtml(md)
    bodyText += blocksText(md)
  })

  const cta =
    content.ctaLabel && frame.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:999px;background:${C.ink}"><a href="${escapeHtml(frame.ctaUrl)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.paper};text-decoration:none;border-radius:999px">${escapeHtml(fill(content.ctaLabel))}</a></td></tr></table>`
      : ''

  // EM-00: "¿Dudas? Respondé este email o escribinos por WhatsApp. · LaRutina Beauty · [razón social] · Darte de baja (solo marketing)".
  const footerParts = [
    `¿Dudas? Respondé este email${frame.whatsappUrl ? ` o <a href="${escapeHtml(frame.whatsappUrl)}" style="color:${C.muted}">escribinos por WhatsApp</a>` : ''}.`,
    escapeHtml(frame.brandFullName),
    frame.legalName ? escapeHtml(frame.legalName) : '',
    content.marketing && frame.unsubscribeUrl ? `<a href="${escapeHtml(frame.unsubscribeUrl)}" style="color:${C.muted}">Darte de baja</a>` : '',
  ].filter(Boolean)

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.shell};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.shell}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 18px"><a href="${escapeHtml(frame.siteUrl)}"><img src="${escapeHtml(frame.logoUrl)}" width="180" alt="${escapeHtml(frame.brandFullName)}" style="display:block;width:180px;height:auto;border:0"></a></td></tr>
<tr><td style="background:${C.paper};border-radius:28px 12px 28px 12px;padding:34px 30px;border:1px solid ${C.line}">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${C.ink};font-weight:800;letter-spacing:-0.01em">${escapeHtml(subject)}</h1>
${bodyHtml}${cta}
</td></tr>
<tr><td style="padding:20px 10px 0;font-size:13px;line-height:1.6;color:${C.muted};text-align:center">${footerParts.join(' · ')}</td></tr>
</table></td></tr></table></body></html>`

  const footerText = [
    `¿Dudas? Respondé este email${frame.whatsappUrl ? ` o escribinos por WhatsApp: ${frame.whatsappUrl}` : ''}.`,
    frame.brandFullName,
    frame.legalName,
    content.marketing && frame.unsubscribeUrl ? `Darte de baja: ${frame.unsubscribeUrl}` : '',
  ].filter(Boolean)
  const text = [subject, '', bodyText.replace(/\n{3,}/g, '\n\n').trim(), content.ctaLabel && frame.ctaUrl ? `\n${fill(content.ctaLabel)}: ${frame.ctaUrl}` : '', '', '—', footerText.join(' · ')].join('\n')

  return { subject, html, text }
}
