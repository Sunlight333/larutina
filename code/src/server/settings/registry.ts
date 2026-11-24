// Every panel-editable setting (GEN-07, 03 §4), with its default. A row in
// `settings` exists only once someone changes a value, so adding a setting is
// adding an entry here. Values marked "pendiente" block launch, not
// development. Copy comes from the content file (A4), Rioplatense Spanish.

export type SettingType = 'text' | 'textarea' | 'number' | 'money' | 'boolean' | 'codes' | 'links' | 'image' | 'url' | 'email'

export type LinkItem = { label: string; href: string; highlight?: boolean }

export type SettingDef = {
  key: string
  group: SettingGroup
  label: string
  type: SettingType
  default: unknown
  help?: string
  adminOnly?: boolean // only the Administración role may change it
}

export const SETTING_GROUPS = {
  brand: 'Marca',
  company: 'Empresa y contacto',
  site: 'Sitio',
  navigation: 'Menú y footer',
  catalog: 'Catálogo',
  listing: 'Listado',
  commerce: 'Envíos y pagos',
  copy: 'Textos generales',
} as const
export type SettingGroup = keyof typeof SETTING_GROUPS

const defs = [
  // Brand (GEN-07)
  { key: 'brand.name', group: 'brand', label: 'Nombre de la marca en los textos', type: 'text', default: 'LaRutina' },
  { key: 'brand.fullName', group: 'brand', label: 'Nombre en títulos, SEO y legales', type: 'text', default: 'LaRutina Beauty' },
  { key: 'brand.domain', group: 'brand', label: 'Dominio', type: 'text', default: 'larutinabeauty.com' },
  { key: 'brand.senderName', group: 'brand', label: 'Remitente de los emails', type: 'text', default: 'LaRutina' },
  { key: 'brand.senderEmail', group: 'brand', label: 'Email remitente', type: 'email', default: '', help: 'Pendiente: depende del dominio de email.' },
  { key: 'brand.tagline', group: 'brand', label: 'Frase del footer', type: 'text', default: 'Cuidar tu piel es tu rutina.' },

  // Company (GEN-07, CMS-06)
  { key: 'company.legalName', group: 'company', label: 'Razón social', type: 'text', default: '', help: 'Pendiente. Se usa en el footer, los legales y los emails.' },
  { key: 'company.cuit', group: 'company', label: 'CUIT', type: 'text', default: '' },
  { key: 'company.address', group: 'company', label: 'Domicilio legal', type: 'text', default: '' },
  { key: 'company.dataFiscalImage', group: 'company', label: 'Imagen de Data Fiscal (ARCA)', type: 'image', default: '' },
  { key: 'company.dataFiscalUrl', group: 'company', label: 'Link de Data Fiscal', type: 'url', default: '' },
  { key: 'company.ventanillaUnicaUrl', group: 'company', label: 'Link a la Ventanilla Única Federal', type: 'url', default: 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario' },
  { key: 'company.whatsapp', group: 'company', label: 'WhatsApp', type: 'text', default: '+54 9 11 5039-0302', help: 'Con código de país. Vacío oculta los botones de WhatsApp.' },
  { key: 'company.whatsappActive', group: 'company', label: 'WhatsApp activo', type: 'boolean', default: false, help: 'Mostrar los botones de WhatsApp en el sitio.' },
  { key: 'company.email', group: 'company', label: 'Email de contacto', type: 'email', default: '' },
  { key: 'company.instagram', group: 'company', label: 'Instagram (URL)', type: 'url', default: '' },
  { key: 'company.tiktok', group: 'company', label: 'TikTok (URL)', type: 'url', default: '' },
  { key: 'company.supportHours', group: 'company', label: 'Horario de atención', type: 'text', default: 'Lunes a viernes de 9 a 18 h' },
  { key: 'company.bankHolder', group: 'company', label: 'Transferencias: titular', type: 'text', default: '', help: 'Pendiente (CF-03). Sin titular, CBU o alias, el pago por transferencia no se ofrece.' },
  { key: 'company.bankName', group: 'company', label: 'Transferencias: banco', type: 'text', default: '' },
  { key: 'company.bankCbu', group: 'company', label: 'Transferencias: CBU o CVU', type: 'text', default: '' },
  { key: 'company.bankAlias', group: 'company', label: 'Transferencias: alias', type: 'text', default: '' },

  // Site (GEN-08, GEN-09, IR-02)
  { key: 'site.waitlistMode', group: 'site', label: 'Ventana "Próximamente" (lista de espera)', type: 'boolean', default: true, help: 'Al entrar, las visitas ven una ventana con la lista de espera que pueden cerrar para recorrer el sitio. Hasta el lanzamiento el sitio no se indexa.', adminOnly: true },
  { key: 'site.maintenanceMode', group: 'site', label: 'Modo mantenimiento', type: 'boolean', default: false, help: 'Las visitas ven la página de mantenimiento. El equipo con sesión sigue viendo el sitio.', adminOnly: true },
  { key: 'site.indexing', group: 'site', label: 'Permitir que los buscadores indexen el sitio', type: 'boolean', default: false, help: 'Se activa el día del lanzamiento.', adminOnly: true },
  { key: 'site.ogImage', group: 'site', label: 'Imagen por defecto al compartir (1200 × 630)', type: 'image', default: '' },
  { key: 'site.homeDescription', group: 'site', label: 'Descripción de la Home (SEO y al compartir)', type: 'textarea', default: 'Skincare elegido con criterio: productos, rutinas y un diagnóstico que te dice qué usar y por qué.' },

  // Navigation (NAV-01, CMS-06)
  {
    key: 'navigation.menu', group: 'navigation', label: 'Menú principal', type: 'links',
    default: [
      { label: 'Productos', href: '/productos' },
      { label: 'Necesidades', href: '/necesidades' },
      { label: 'Marcas', href: '/marcas' },
      { label: 'Journal', href: '/journal' },
      { label: 'Diagnóstico', href: '/diagnostico', highlight: true },
    ] satisfies LinkItem[],
    help: '"Destacado" muestra el ítem como botón.',
  },
  { key: 'navigation.footerShop', group: 'navigation', label: 'Footer: columna Comprar', type: 'links', default: [{ label: 'Productos', href: '/productos' }, { label: 'Rutinas', href: '/rutinas' }, { label: 'Diagnóstico de piel', href: '/diagnostico' }, { label: 'Marcas', href: '/marcas' }] satisfies LinkItem[] },
  { key: 'navigation.footerHelp', group: 'navigation', label: 'Footer: columna Ayuda', type: 'links', default: [{ label: 'Contacto', href: '/contacto' }, { label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' }, { label: 'Envíos y devoluciones', href: '/envios-y-devoluciones' }] satisfies LinkItem[] },
  { key: 'navigation.footerAbout', group: 'navigation', label: 'Footer: columna Larutina', type: 'links', default: [{ label: 'Nosotras', href: '/nosotras' }, { label: 'Journal', href: '/journal' }] satisfies LinkItem[] },

  // Catalog (PDP-02, PDP-03, CAT-12, CAT-14, CAT-18)
  { key: 'catalog.vatRate', group: 'catalog', label: 'Alícuota general de IVA (%)', type: 'number', default: 21, help: 'Para el "precio sin impuestos nacionales". Un producto puede tener la suya.' },
  { key: 'catalog.newDays', group: 'catalog', label: 'Días con la etiqueta "Nuevo"', type: 'number', default: 30, help: '0 desactiva la etiqueta automática.' },
  { key: 'catalog.dermatologistLabelEnabled', group: 'catalog', label: 'Habilitar la etiqueta "Recomendado por dermatóloga"', type: 'boolean', default: false },
  { key: 'catalog.sealFilter', group: 'catalog', label: 'Filtro por sellos en el listado', type: 'boolean', default: false },
  { key: 'catalog.evaluationVisible', group: 'catalog', label: 'Mostrar la evaluación en el sitio', type: 'boolean', default: false, help: 'Apagado hasta que exista el método publicado (D-10).' },
  { key: 'catalog.pdpRelevance', group: 'catalog', label: 'Relevancia mínima para "Para qué sirve"', type: 'number', default: 50 },
  { key: 'catalog.reviewsMinimum', group: 'catalog', label: 'Reseñas aprobadas para mostrar el bloque', type: 'number', default: 3, help: 'Con menos, la ficha no muestra reseñas ni puntaje (PDP-07).' },
  {
    key: 'catalog.genericPrecautions', group: 'catalog', label: 'Precauciones genéricas', type: 'textarea',
    default: 'Si notás ardor o rojez que no se va, dejá de usarlo y consultá.',
    help: 'Se muestran cuando el producto no tiene precauciones propias. Las advertencias de familias y conflictos se suman solas.',
  },

  // Listing (NAV-02, NAV-03, IR-05)
  { key: 'listing.pageSize', group: 'listing', label: 'Productos por página', type: 'number', default: 24 },
  { key: 'listing.concernOrder', group: 'listing', label: 'Orden de las necesidades (filtros y menú)', type: 'codes', default: [] as string[], help: 'Códigos de necesidad, uno por línea. Vacío: orden alfabético.' },
  { key: 'listing.featured', group: 'listing', label: 'Productos destacados', type: 'codes', default: [] as string[], help: 'Códigos de producto, uno por línea.' },
  { key: 'listing.bestSellers', group: 'listing', label: 'Orden "Más vendidos"', type: 'boolean', default: false, help: 'Activar cuando haya ventas.' },
  { key: 'listing.topRated', group: 'listing', label: 'Orden "Mejor valorados"', type: 'boolean', default: false, help: 'Activar cuando haya reseñas.' },

  // Commerce: values used by copy now, by checkout in Phase 2
  { key: 'commerce.freeShippingFromCents', group: 'commerce', label: 'Envío gratis desde', type: 'money', default: 0, help: 'Pendiente. 0: la frase de envío gratis no se muestra.' },
  { key: 'commerce.transferDiscountPct', group: 'commerce', label: 'Descuento por transferencia (%)', type: 'number', default: 0, help: 'Pendiente (Q-08).' },
  { key: 'commerce.paymentMethods', group: 'commerce', label: 'Medios de pago activos', type: 'codes', default: ['mercadopago', 'tarjetas', 'transferencia'], help: 'mercadopago, tarjetas, transferencia. Solo estos se muestran en el footer y en el checkout.' },
  { key: 'commerce.discountCapPct', group: 'commerce', label: 'Tope de descuento total (%)', type: 'number', default: 0, help: 'Pendiente (D-16): se define antes del lanzamiento. Rutina o código, más transferencia, nunca superan este porcentaje del subtotal. 0: sin tope.', adminOnly: true },
  { key: 'commerce.transferReservationHours', group: 'commerce', label: 'Transferencia: horas de reserva', type: 'number', default: 6, help: 'Si no hay comprobante cargado al vencer, el pedido se cancela y el stock vuelve (CMP-05).' },
  { key: 'commerce.transferReminderHours', group: 'commerce', label: 'Transferencia: recordatorio a las (horas)', type: 'number', default: 3 },
  { key: 'commerce.cardReservationMinutes', group: 'commerce', label: 'Mercado Pago: minutos para pagar', type: 'number', default: 60, help: 'El stock queda reservado mientras la clienta paga. Un pago pendiente en efectivo extiende la reserva.' },
  { key: 'commerce.cashVouchers', group: 'commerce', label: 'Pago en efectivo (Pago Fácil, Rapipago)', type: 'boolean', default: true, help: 'Por Mercado Pago. Pendiente de confirmar (Q-01).' },
  { key: 'commerce.cashReservationHours', group: 'commerce', label: 'Efectivo: horas de reserva', type: 'number', default: 48 },
  { key: 'commerce.cashReminderHours', group: 'commerce', label: 'Efectivo: recordatorio a las (horas)', type: 'number', default: 24 },
  { key: 'commerce.maxInstallments', group: 'commerce', label: 'Mercado Pago: cuotas máximas', type: 'number', default: 12, help: 'Las cuotas sin interés y las promociones se configuran en la cuenta de Mercado Pago.' },
  { key: 'commerce.installmentsText', group: 'commerce', label: 'Texto de cuotas en la ficha', type: 'text', default: '', help: 'Por ejemplo "Hasta 3 cuotas sin interés con Mercado Pago". Vacío: no se muestra (PDP-06).' },
  { key: 'commerce.shippingOptions', group: 'commerce', label: 'Opciones de envío que se muestran', type: 'number', default: 3, help: 'Las más baratas primero (BO-08).' },
  { key: 'commerce.reviewRequestDays', group: 'commerce', label: 'Pedido de reseña: días después de la entrega', type: 'number', default: 21, help: 'EML-03.' },
  { key: 'commerce.abandonedCartHours', group: 'commerce', label: 'Carrito abandonado: horas', type: 'number', default: 24, help: 'Un solo email, y solo si la clienta dejó su email en el checkout (EML-04). 0: no se envía.' },

  // Copy used in several places (GEN-06, G-12, G-17, G-25, G-26)
  { key: 'copy.healthNotice', group: 'copy', label: 'Aviso de salud', type: 'textarea', default: 'Esto no es un diagnóstico médico: es una recomendación de productos según lo que nos contás. Si tenés una condición de la piel, estás en tratamiento o algo te preocupa, consultá con una dermatóloga.' },
  { key: 'copy.newsletterTitle', group: 'copy', label: 'Newsletter: título', type: 'text', default: 'Una vez por mes, lo que vale la pena saber sobre tu piel.' },
  { key: 'copy.newsletterText', group: 'copy', label: 'Newsletter: texto', type: 'text', default: 'Rutinas, ingredientes explicados y novedades del catálogo. Te podés dar de baja cuando quieras.' },
  { key: 'copy.waitlistTitle', group: 'copy', label: 'Próximamente: título', type: 'text', default: 'Estamos terminando de armar {marca}.' },
  { key: 'copy.waitlistText', group: 'copy', label: 'Próximamente: texto', type: 'textarea', default: 'Dejanos tu email y te avisamos el día que abrimos. Un solo aviso, sin spam.' },
  { key: 'copy.waitlistImage', group: 'copy', label: 'Próximamente: imagen', type: 'image', default: '' },
  { key: 'copy.maintenanceText', group: 'copy', label: 'Mantenimiento: texto', type: 'textarea', default: 'Estamos trabajando para mejorar tu experiencia. Volvé en un rato.' },
  { key: 'copy.searchPlaceholder', group: 'copy', label: 'Buscador: texto de ayuda', type: 'text', default: 'Buscá un producto, una marca o lo que querés mejorar' },
  { key: 'copy.diagnosisQuestions', group: 'copy', label: 'Cantidad de preguntas del diagnóstico', type: 'number', default: 8, help: 'Variable {preguntas}. Pasa a calcularse sola cuando el diagnóstico se arme desde el panel (Fase 3).' },
] as const satisfies readonly SettingDef[]

export const SETTINGS: readonly SettingDef[] = defs

export type SettingKey = (typeof defs)[number]['key']

type Widen<T> = T extends boolean ? boolean : T extends number ? number : T extends string ? string : T extends readonly LinkItem[] ? LinkItem[] : T extends readonly string[] ? string[] : T
export type SettingValues = { [D in (typeof defs)[number] as D['key']]: Widen<D['default']> }

export const settingDef = (key: string) => SETTINGS.find((d) => d.key === key)

export function defaultSettings(): SettingValues {
  return Object.fromEntries(SETTINGS.map((d) => [d.key, structuredClone(d.default)])) as SettingValues
}
