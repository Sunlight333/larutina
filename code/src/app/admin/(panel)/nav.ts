import type { Permission } from '@/server/auth/permissions'

// Every panel section, in menu order. A role sees only the items it has the
// permission for; each page still checks on the server.
export type NavItem = { href: string; label: string; permission?: Permission }
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { label: '', items: [{ href: '/admin', label: 'Inicio' }] },
  {
    label: 'Catálogo',
    items: [
      { href: '/admin/productos', label: 'Productos', permission: 'catalog.view' },
      { href: '/admin/catalogo/importar', label: 'Importar planilla', permission: 'catalog.import' },
      { href: '/admin/catalogo/lote', label: 'Exportar y actualizar en lote', permission: 'catalog.import' },
      { href: '/admin/marcas', label: 'Marcas', permission: 'catalog.view' },
      { href: '/admin/categorias', label: 'Categorías', permission: 'catalog.view' },
      { href: '/admin/necesidades', label: 'Necesidades', permission: 'catalog.view' },
      { href: '/admin/ingredientes', label: 'Ingredientes', permission: 'catalog.view' },
      { href: '/admin/sinonimos', label: 'Sinónimos del buscador', permission: 'catalog.view' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { href: '/admin/paginas', label: 'Home y páginas', permission: 'content.edit' },
      { href: '/admin/journal', label: 'Journal', permission: 'content.edit' },
      { href: '/admin/legales', label: 'Legales', permission: 'content.edit' },
      { href: '/admin/anuncios', label: 'Barra de anuncios', permission: 'content.edit' },
      { href: '/admin/medios', label: 'Imágenes', permission: 'media.manage' },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { href: '/admin/mensajes', label: 'Mensajes de contacto', permission: 'messages.view' },
      { href: '/admin/suscriptores', label: 'Lista de espera y newsletter', permission: 'subscribers.export' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/configuracion', label: 'Configuración' },
      { href: '/admin/usuarios', label: 'Usuarios', permission: 'users.manage' },
      { href: '/admin/registro', label: 'Registro de cambios', permission: 'audit.view' },
      { href: '/admin/papelera', label: 'Papelera', permission: 'catalog.edit' },
      { href: '/admin/cuenta', label: 'Mi cuenta' },
    ],
  },
]
