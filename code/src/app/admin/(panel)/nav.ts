import type { Permission } from '@/server/auth/permissions'

// Every panel section, in menu order. A role sees only the items it has the
// permission for; each page still checks on the server.
export type NavItem = { href: string; label: string; permission?: Permission }
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { label: '', items: [{ href: '/', label: 'Inicio' }] },
  {
    label: 'Catálogo',
    items: [
      { href: '/productos', label: 'Productos', permission: 'catalog.view' },
      { href: '/catalogo/importar', label: 'Importar planilla', permission: 'catalog.import' },
      { href: '/catalogo/lote', label: 'Exportar y actualizar en lote', permission: 'catalog.import' },
      { href: '/marcas', label: 'Marcas', permission: 'catalog.view' },
      { href: '/categorias', label: 'Categorías', permission: 'catalog.view' },
      { href: '/necesidades', label: 'Necesidades', permission: 'catalog.view' },
      { href: '/ingredientes', label: 'Ingredientes', permission: 'catalog.view' },
      { href: '/sinonimos', label: 'Sinónimos del buscador', permission: 'catalog.view' },
      { href: '/rutinas', label: 'Rutinas armadas', permission: 'catalog.view' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { href: '/paginas', label: 'Home y páginas', permission: 'content.edit' },
      { href: '/journal', label: 'Journal', permission: 'content.edit' },
      { href: '/legales', label: 'Legales', permission: 'content.edit' },
      { href: '/anuncios', label: 'Barra de anuncios', permission: 'content.edit' },
      { href: '/medios', label: 'Imágenes', permission: 'media.manage' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/pedidos', label: 'Pedidos', permission: 'orders.view' },
      { href: '/arrepentimientos', label: 'Arrepentimientos', permission: 'orders.view' },
      { href: '/resenas', label: 'Reseñas', permission: 'reviews.moderate' },
      { href: '/cupones', label: 'Cupones', permission: 'commerce.settings' },
      { href: '/envios', label: 'Cajas y tarifas de envío', permission: 'commerce.settings' },
      { href: '/stock', label: 'Stock y avisos', permission: 'stock.adjust' },
      { href: '/margenes', label: 'Márgenes', permission: 'catalog.cost' },
      { href: '/emails', label: 'Emails', permission: 'emails.edit' },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { href: '/mensajes', label: 'Mensajes de contacto', permission: 'messages.view' },
      { href: '/suscriptores', label: 'Lista de espera y newsletter', permission: 'subscribers.export' },
      { href: '/embajadoras', label: 'Embajadoras', permission: 'ambassadors.manage' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/configuracion', label: 'Configuración' },
      { href: '/usuarios', label: 'Usuarios', permission: 'users.manage' },
      { href: '/registro', label: 'Registro de cambios', permission: 'audit.view' },
      { href: '/papelera', label: 'Papelera', permission: 'catalog.edit' },
      { href: '/cuenta', label: 'Mi cuenta' },
    ],
  },
]
