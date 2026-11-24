// Where to go back after signing in. Only a path on this site: an absolute or
// protocol-relative URL ("//evil.com", "/\evil.com") would turn the login into
// an open redirect. The sign-in pages themselves are not a destination.

const AUTH_PAGES = ['/cuenta/ingresar', '/cuenta/crear', '/cuenta/recuperar', '/cuenta/nueva-contrasena']

export function safeReturnPath(raw: unknown, fallback = '/cuenta'): string {
  if (typeof raw !== 'string') return fallback
  const path = raw.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 500) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback
  let url: URL
  try {
    url = new URL(path, 'https://sitio.invalid')
  } catch {
    return fallback
  }
  if (url.origin !== 'https://sitio.invalid') return fallback
  if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}

/** The sign-in link that brings her back to `path` (and, from a product, saves it as a favourite on return). */
export function signInHref(path: string, opts: { save?: string; page?: 'ingresar' | 'crear' } = {}): string {
  const q = new URLSearchParams({ volver: path })
  if (opts.save) q.set('guardar', opts.save)
  return `/cuenta/${opts.page ?? 'ingresar'}?${q}`
}
