import type { AdminRole } from '@prisma/client'

// ADM-01: five roles, each with the minimum it needs. The server checks these
// on every admin page and action; the menu only hides what a role cannot use.

export const PERMISSIONS = {
  'catalog.view': 'Ver el catálogo',
  'catalog.edit': 'Editar productos, marcas y taxonomías',
  'catalog.import': 'Importar, exportar y actualizar en lote',
  'catalog.cost': 'Ver costo y margen',
  'content.edit': 'Editar páginas, journal, legales, menú y anuncios',
  'settings.brand': 'Configurar marca, empresa y sitio',
  'settings.catalog': 'Configurar catálogo y listado',
  'settings.content': 'Configurar menú y textos generales',
  'media.manage': 'Subir y borrar imágenes',
  'messages.view': 'Ver mensajes de contacto',
  'subscribers.export': 'Exportar lista de espera y newsletter',
  'users.manage': 'Administrar usuarios del panel',
  'audit.view': 'Ver el registro de cambios',
  'ambassadors.manage': 'Administrar embajadoras',
} as const
export type Permission = keyof typeof PERMISSIONS

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Administración',
  CATALOG: 'Catálogo',
  CONTENT: 'Contenido',
  SUPPORT: 'Atención',
  AMBASSADORS: 'Embajadoras',
}

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  ADMIN: Object.keys(PERMISSIONS) as Permission[],
  CATALOG: ['catalog.view', 'catalog.edit', 'catalog.import', 'settings.catalog', 'media.manage'],
  CONTENT: ['catalog.view', 'content.edit', 'settings.content', 'media.manage', 'subscribers.export'],
  SUPPORT: ['catalog.view', 'messages.view'],
  AMBASSADORS: ['catalog.view', 'ambassadors.manage'],
}

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsOf(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}
