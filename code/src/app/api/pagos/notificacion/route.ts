import { NextResponse } from 'next/server'
import { getDb } from '@/server/db'
import { paymentProvider, receiveNotification } from '@/server/commerce/payments'

// POST /api/pagos/notificacion: Mercado Pago's webhook (CMP-04). The signature
// is checked, the notification stored once by its key (a replay is a no-op)
// and the payment read again from the provider, which is what moves the
// order. A 500 makes Mercado Pago retry.
export async function POST(req: Request) {
  const db = getDb()
  const provider = paymentProvider(db)
  if (!provider) return NextResponse.json({ error: 'no payment provider' }, { status: 404 })
  let body: unknown = null
  try {
    const text = await req.text()
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const result = await receiveNotification(db, provider, { url: new URL(req.url), headers: req.headers, body })
  return NextResponse.json({ ok: result.status === 200, reason: result.reason }, { status: result.status })
}
