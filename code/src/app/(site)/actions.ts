'use server'

import { z } from 'zod'
import { getDb } from '@/server/db'
import { rateLimit } from '@/server/rate-limit'
import { clientIp } from '@/server/request'
import { NEWSLETTER_CONSENT, WAITLIST_CONSENT } from '@/lib/consent'

// Public sign-ups: the waitlist (GEN-08) and the newsletter (G-17). The exact
// consent text shown is stored with each email (Ley 25.326).

export type SignupState = { ok: boolean; message: string; email?: string } | null

const email = z.string().trim().toLowerCase().email().max(200)


async function limited(kind: string) {
  return !rateLimit(`${kind}:${await clientIp()}`, 10, 60 * 60 * 1000).ok
}

export async function joinWaitlist(_prev: SignupState, form: FormData): Promise<SignupState> {
  if (form.get('website')) return { ok: true, message: 'Listo. Te escribimos cuando abramos.' } // honeypot
  const parsed = email.safeParse(form.get('email'))
  if (!parsed.success) return { ok: false, message: 'Revisá el email: parece que falta algo.' }
  if (form.get('consent') !== 'on') return { ok: false, message: 'Para avisarte necesitamos tu consentimiento.' }
  if (await limited('waitlist')) return { ok: false, message: 'Recibimos muchos intentos. Probá de nuevo en un rato.' }
  await getDb().waitlistSignup.upsert({ where: { email: parsed.data }, create: { email: parsed.data, consentText: WAITLIST_CONSENT }, update: {} })
  return { ok: true, message: 'Listo. Te escribimos cuando abramos.', email: parsed.data }
}

export async function subscribeNewsletter(_prev: SignupState, form: FormData): Promise<SignupState> {
  if (form.get('website')) return { ok: true, message: 'Listo.' }
  const parsed = email.safeParse(form.get('email'))
  if (!parsed.success) return { ok: false, message: 'Revisá el email: parece que falta algo.' }
  if (form.get('consent') !== 'on') return { ok: false, message: 'Para suscribirte necesitamos tu consentimiento.' }
  if (await limited('newsletter')) return { ok: false, message: 'Recibimos muchos intentos. Probá de nuevo en un rato.' }
  const source = String(form.get('source') ?? 'footer').slice(0, 40)
  await getDb().newsletterSubscriber.upsert({
    where: { email: parsed.data },
    create: { email: parsed.data, consentText: NEWSLETTER_CONSENT, source },
    update: { unsubscribedAt: null },
  })
  return { ok: true, message: `Listo. Te escribimos a ${parsed.data}.`, email: parsed.data }
}
