// The two hosts the app answers on: the storefront (NEXT_PUBLIC_SITE_URL,
// e.g. https://larutinabeauty.com) and the panel on its "admin." subdomain
// (https://admin.larutinabeauty.com). Locally: http://localhost:3000 and
// http://admin.localhost:3000 (browsers resolve *.localhost to this machine).
//
// The panel's routes live under app/admin; src/proxy.ts serves them at the
// root of the panel host (admin.…/productos → app/admin/productos), so links
// inside the panel are written without the /admin prefix. Links that cross
// hosts (panel → storefront, storefront → panel) must be absolute: use
// siteHref and adminHref.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

const site = new URL(SITE_URL)

export const ADMIN_HOST = `admin.${site.hostname}`
export const ADMIN_URL = `${site.protocol}//admin.${site.host}`

export const siteHref = (path: string) => `${SITE_URL}${path}`
export const adminHref = (path = '/') => `${ADMIN_URL}${path}`

const isLocal = site.hostname === 'localhost' || site.hostname.endsWith('.localhost') || /^[\d.]+$|:/.test(site.hostname)

/**
 * The Domain of the panel's session cookie: the site's domain, so the cookie
 * set at sign-in on admin.… also reaches the storefront, which recognises the
 * team in maintenance mode and for "vista previa" links (GEN-09). Locally the
 * cookie stays on the panel host, since browsers refuse Domain=localhost.
 */
export const SESSION_COOKIE_DOMAIN = isLocal ? undefined : site.hostname
