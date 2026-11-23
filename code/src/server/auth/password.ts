import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt from node:crypto, no native dependency. Stored as
// scrypt$N$r$p$salt$hash (base64), so parameters can be raised later.

const N = 2 ** 15
const R = 8
const P = 1
const KEYLEN = 64

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** 12+ characters; the panel shows this rule next to the field. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'La contraseña necesita al menos 12 caracteres.'
  if (password.length > 200) return 'La contraseña es demasiado larga.'
  return null
}
