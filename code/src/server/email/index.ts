// Emails: written to the outbox (`email_messages`) in the same transaction as
// the change that causes them, then sent by the sweep through the provider.
// The dedupe key makes a transactional email go out once per event (EML-02).
//
// The provider sits behind an interface (02 §4). ADR-004 (which transactional
// provider) is still open: `EMAIL_PROVIDER=resend` with `RESEND_API_KEY`
// sends through Resend; without a provider or a sender address, every email is
// kept in the log as "SKIPPED" and can be read in the panel.
import type { Prisma, PrismaClient } from '@prisma/client'
import type { CopyVariables } from '@/lib/copy-variables'
import { whatsappLink } from '@/lib/whatsapp'
import { loadSettings, type SettingValues } from '@/server/settings'
import { renderEmail, type EmailBank, type EmailDetail, type EmailFrame } from './render'
import { emailTemplateDef } from './templates'

type Db = PrismaClient | Prisma.TransactionClient

export type OutgoingEmail = { from: string; to: string; replyTo?: string; subject: string; html: string; text: string }

export interface EmailProvider {
  readonly name: string
  send(email: OutgoingEmail): Promise<{ id: string }>
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  constructor(private readonly key: string) {}
  async send(email: OutgoingEmail) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: email.from, to: [email.to], reply_to: email.replyTo, subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? 'error'}`)
    return { id: body.id }
  }
}

export function emailProvider(): EmailProvider | null {
  if (process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) return new ResendProvider(process.env.RESEND_API_KEY)
  return null
}

export function siteUrl(s: Pick<SettingValues, 'brand.domain'>): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || `https://${s['brand.domain']}`).replace(/\/+$/, '')
}

export function emailFrame(s: SettingValues, ctaPath: string | null, extra: Partial<EmailFrame> = {}): EmailFrame {
  const base = siteUrl(s)
  return {
    siteUrl: base,
    brandName: s['brand.name'],
    brandFullName: s['brand.fullName'],
    legalName: s['company.legalName'],
    logoUrl: `${base}/images/brand/logo-email.png`,
    whatsappUrl: s['company.whatsappActive'] && s['company.whatsapp'] ? whatsappLink(s['company.whatsapp']) : null,
    ctaUrl: ctaPath ? (/^https?:\/\//.test(ctaPath) ? ctaPath : `${base}${ctaPath}`) : null,
    ...extra,
  }
}

export type EnqueueInput = {
  template: string
  to: string
  vars: CopyVariables
  ctaPath?: string | null
  blocks?: { detalle?: EmailDetail; datos_bancarios?: EmailBank }
  /** One email per key, ever (EML-02). */
  dedupeKey?: string
  related?: { type: string; id: string }
  sendAfter?: Date
}

/** Renders now (the copy as it reads at the moment of the event) and queues. Returns false when the dedupe key was already used. */
export async function enqueueEmail(db: Db, input: EnqueueInput, settings?: SettingValues): Promise<boolean> {
  const def = emailTemplateDef(input.template)
  if (!def) throw new Error(`Unknown email template ${input.template}`)
  const s = settings ?? (await loadSettings(db as PrismaClient))
  const override = await db.emailTemplate.findUnique({ where: { key: def.key } })
  const content = override ? { subject: override.subject, preheader: override.preheader, body: override.body, ctaLabel: override.ctaLabel, marketing: def.marketing } : def
  const { subject, html, text } = renderEmail(content, { marca: s['brand.name'], ...input.vars }, emailFrame(s, input.ctaPath ?? null), input.blocks)
  const created = await db.emailMessage.createMany({
    data: [
      {
        template: def.key,
        dedupeKey: input.dedupeKey ?? null,
        to: input.to.toLowerCase(),
        subject,
        html,
        text,
        relatedType: input.related?.type ?? null,
        relatedId: input.related?.id ?? null,
        sendAfter: input.sendAfter ?? new Date(),
      },
    ],
    skipDuplicates: true,
  })
  return created.count > 0
}

const MAX_ATTEMPTS = 5

/** Sends what is due. Called by the sweep; safe to call concurrently (each row is claimed first). */
export async function sendQueuedEmails(db: PrismaClient, limit = 25, provider: EmailProvider | null = emailProvider()): Promise<{ sent: number; failed: number; skipped: number }> {
  const s = await loadSettings(db)
  const due = await db.emailMessage.findMany({ where: { status: 'QUEUED', sendAfter: { lte: new Date() } }, orderBy: { sendAfter: 'asc' }, take: limit })
  const result = { sent: 0, failed: 0, skipped: 0 }
  const from = s['brand.senderEmail'] ? `${s['brand.senderName']} <${s['brand.senderEmail']}>` : null
  for (const m of due) {
    // Claim: push sendAfter forward so a parallel sweep skips it while this one works.
    const claimed = await db.emailMessage.updateMany({ where: { id: m.id, status: 'QUEUED', sendAfter: m.sendAfter }, data: { sendAfter: new Date(Date.now() + 5 * 60_000), attempts: { increment: 1 } } })
    if (!claimed.count) continue
    if (!provider || !from) {
      await db.emailMessage.update({ where: { id: m.id }, data: { status: 'SKIPPED', lastError: !provider ? 'Sin proveedor de email configurado' : 'Sin email remitente en Configuración' } })
      result.skipped++
      continue
    }
    try {
      const { id } = await provider.send({ from, to: m.to, replyTo: s['company.email'] || undefined, subject: m.subject, html: m.html, text: m.text })
      await db.emailMessage.update({ where: { id: m.id }, data: { status: 'SENT', sentAt: new Date(), providerId: id, lastError: null } })
      result.sent++
    } catch (e) {
      const attempts = m.attempts + 1
      const done = attempts >= MAX_ATTEMPTS
      await db.emailMessage.update({
        where: { id: m.id },
        data: { status: done ? 'FAILED' : 'QUEUED', lastError: (e as Error).message.slice(0, 500), sendAfter: new Date(Date.now() + 2 ** attempts * 60_000) },
      })
      result.failed++
    }
  }
  return result
}
