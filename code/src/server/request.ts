import { headers } from 'next/headers'

/** The visitor's IP: Cloudflare's header first, then the proxy chain. */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get('user-agent')
}
