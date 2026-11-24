// The emails and their default texts, from the content file (A4, EM-00 to
// EM-21) with the 21/11 fixes ("carrito" for "bolsa", D-05). Every text is
// editable in the panel (EML-01): a row in `email_templates` overrides the
// default here. Bodies use the panel's Markdown subset and {variables}; a
// line holding only {detalle} or {datos_bancarios} becomes that block.

export type EmailTemplateDef = {
  key: string
  code: string // content file row
  label: string
  subject: string
  preheader: string
  body: string
  ctaLabel: string
  /** Marketing emails carry "Darte de baja" (EM-00). */
  marketing?: boolean
  variables: string[]
}

const ORDER_VARS = ['nombre', 'numero', 'total', 'marca']

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: 'order_confirmed',
    code: 'EM-01',
    label: 'Pedido confirmado',
    subject: 'Tu pedido #{numero} está confirmado',
    preheader: 'Lo empezamos a preparar.',
    body: 'Hola, {nombre}. Recibimos tu pago y ya estamos preparando tu pedido. Abajo tenés el detalle. Cuando salga, te mandamos el seguimiento.\n\n{detalle}',
    ctaLabel: 'Ver mi pedido',
    variables: [...ORDER_VARS, 'detalle'],
  },
  {
    key: 'transfer_pending',
    code: 'EM-02',
    label: 'Transferencia pendiente',
    subject: 'Tu pedido #{numero} está reservado',
    preheader: 'Transferí {total} antes de las {hora}.',
    body: 'Para confirmarlo, transferí {total} (ya tiene el descuento por transferencia) a:\n\n{datos_bancarios}\n\nTenés hasta las {hora} ({horas} horas). Respondé este email con el comprobante o [subilo desde tu pedido]({link_pedido}).\n\n{detalle}',
    ctaLabel: 'Copiar alias',
    variables: [...ORDER_VARS, 'hora', 'horas', 'datos_bancarios', 'detalle', 'link_pedido'],
  },
  {
    key: 'transfer_reminder',
    code: 'EM-03',
    label: 'Transferencia: recordatorio',
    subject: 'Tu pedido #{numero} sigue reservado',
    preheader: 'Tenés hasta las {hora}.',
    body: 'Todavía no vimos tu transferencia. Si ya la hiciste, respondé con el comprobante o [subilo desde tu pedido]({link_pedido}). Si no, tenés hasta las {hora}.\n\n{datos_bancarios}',
    ctaLabel: '',
    variables: [...ORDER_VARS, 'hora', 'datos_bancarios', 'link_pedido'],
  },
  {
    key: 'cash_reminder',
    code: 'IR-14',
    label: 'Pago en efectivo: recordatorio',
    subject: 'Tu pedido #{numero} sigue reservado',
    preheader: 'Tenés hasta las {hora}.',
    body: 'Todavía no vimos tu pago en efectivo. Si ya pagaste, puede tardar unas horas en acreditarse y te avisamos apenas llegue. Si no, tenés hasta las {hora} del {dia}.',
    ctaLabel: 'Ver mi pedido',
    variables: [...ORDER_VARS, 'hora', 'dia'],
  },
  {
    key: 'order_cancelled',
    code: 'EM-04',
    label: 'Pedido cancelado',
    subject: 'Cancelamos tu pedido #{numero}',
    preheader: '{motivo}',
    body: 'Hola, {nombre}. {motivo}\n\n{devolucion}',
    ctaLabel: 'Volver a la tienda',
    variables: [...ORDER_VARS, 'motivo', 'devolucion'],
  },
  {
    key: 'order_shipped',
    code: 'EM-05',
    label: 'Pedido despachado',
    subject: 'Tu pedido #{numero} ya salió',
    preheader: 'Lo lleva {correo}.',
    body: 'Lo lleva {correo}. Llega en {dias_min} a {dias_max} días hábiles. Número de seguimiento: **{seguimiento}**.',
    ctaLabel: 'Seguir mi envío',
    variables: [...ORDER_VARS, 'correo', 'dias_min', 'dias_max', 'seguimiento'],
  },
  {
    key: 'order_delivered',
    code: 'EM-06',
    label: 'Pedido entregado',
    subject: 'Llegó tu pedido',
    preheader: 'Esperamos que esté todo bien.',
    body: 'Esperamos que esté todo bien. Si es tu primera vez con algún producto, empezá de a uno y probalo primero en una zona chica. Tu rutina, paso a paso, está en tu cuenta.',
    ctaLabel: 'Ver mi rutina',
    variables: ORDER_VARS,
  },
  {
    key: 'review_request',
    code: 'EM-07',
    label: 'Pedido de reseña',
    subject: '¿Cómo te está yendo con {producto}?',
    preheader: 'Tu reseña ayuda a otras a elegir.',
    body: 'Ya pasaron unas semanas. Contanos cómo lo sentís: tu reseña ayuda a otras a elegir.',
    ctaLabel: 'Escribir mi reseña',
    variables: [...ORDER_VARS, 'producto'],
  },
  {
    key: 'refund',
    code: 'EM-08',
    label: 'Reembolso',
    subject: 'Te devolvimos {monto}',
    preheader: 'Pedido #{numero}.',
    body: 'Procesamos el reembolso de tu pedido #{numero} por {medio}. Según tu banco, puede tardar {plazo} en verse.',
    ctaLabel: '',
    variables: [...ORDER_VARS, 'monto', 'medio', 'plazo'],
  },
  {
    key: 'cart_abandoned',
    code: 'EM-09',
    label: 'Carrito abandonado',
    subject: 'Tu carrito quedó guardado',
    preheader: 'Si te quedó una duda, te ayudamos.',
    body: 'Dejaste {productos_carrito} en el carrito. Si te quedó una duda, respondé este email y te ayudamos a elegir.',
    ctaLabel: 'Volver a mi carrito',
    variables: ['productos_carrito', 'marca'],
  },
  {
    key: 'welcome',
    code: 'EM-10',
    label: 'Bienvenida',
    subject: 'Ya tenés tu cuenta en {marca}',
    preheader: 'Tu rutina, tus diagnósticos y tus pedidos.',
    body: 'Desde tu cuenta ves tu rutina, tu historial de diagnósticos y tus pedidos.',
    ctaLabel: 'Ir a mi cuenta',
    variables: ['nombre', 'marca'],
  },
  {
    key: 'password_reset',
    code: 'EM-11',
    label: 'Recuperar contraseña',
    subject: 'Cambiá tu contraseña',
    preheader: 'El link vale por 1 hora.',
    body: 'Pediste cambiar la contraseña. El link vale por 1 hora. Si no fuiste vos, ignorá este email.',
    ctaLabel: 'Crear nueva contraseña',
    variables: ['marca'],
  },
  {
    key: 'account_deleted',
    code: 'CU-17',
    label: 'Cuenta eliminada',
    subject: 'Eliminamos tu cuenta',
    preheader: 'Como pediste, borramos tus datos.',
    body: 'Como pediste, borramos tus datos de perfil, tu historial de diagnósticos, tu rutina y tus favoritos. Los datos de tus compras los tenemos que guardar por obligaciones fiscales y contables durante el plazo que exige la ley.',
    ctaLabel: '',
    variables: ['nombre', 'marca'],
  },
  {
    key: 'back_in_stock',
    code: 'EM-12',
    label: 'Volvió el stock',
    subject: 'Volvió {producto}',
    preheader: 'Nos pediste que te avisáramos.',
    body: 'Nos pediste que te avisáramos.',
    ctaLabel: 'Ver producto',
    variables: ['producto', 'marca'],
  },
  {
    key: 'withdrawal_code',
    code: 'EM-19',
    label: 'Arrepentimiento: código de trámite',
    subject: 'Recibimos tu pedido de arrepentimiento · Código {codigo}',
    preheader: 'Tu código de trámite es {codigo}.',
    body: 'Recibimos tu solicitud para el pedido #{numero}. Tu código de trámite es **{codigo}**. Te escribimos para coordinar el retiro, sin costo para vos.',
    ctaLabel: 'Ver mi pedido',
    variables: ['nombre', 'numero', 'codigo', 'marca'],
  },
  {
    key: 'ambassador_received',
    code: 'EM-15',
    label: 'Embajadora: postulación recibida',
    subject: 'Recibimos tu postulación',
    preheader: 'La revisamos y te escribimos.',
    body: 'Gracias, {nombre}. La revisamos y te escribimos{plazo}.',
    ctaLabel: 'Ver cómo funciona el programa',
    variables: ['nombre', 'plazo', 'marca'],
  },
  {
    key: 'ambassador_approved',
    code: 'EM-16',
    label: 'Embajadora: aprobada',
    subject: 'Ya sos embajadora de {marca}',
    preheader: 'Tu cuenta está activa.',
    body: '{nombre}, tu cuenta está activa. En tu panel tenés tu link, tu código y cómo se calcula tu comisión.',
    ctaLabel: 'Ir a mi panel',
    variables: ['nombre', 'marca'],
  },
  {
    key: 'ambassador_rejected',
    code: 'EM-17',
    label: 'Embajadora: no aprobada',
    subject: 'Sobre tu postulación',
    preheader: 'Gracias por tu interés.',
    body: 'Gracias por tu interés, {nombre}. Por ahora no podemos sumarte al programa. {motivo} Si algo cambia, podés volver a postularte.',
    ctaLabel: '',
    variables: ['nombre', 'motivo', 'marca'],
  },
  {
    key: 'ambassador_settlement',
    code: 'EM-18',
    label: 'Embajadora: liquidación del mes',
    subject: 'Tu liquidación de {mes}',
    preheader: 'Aprobamos {monto} en comisiones.',
    body: 'Aprobamos {monto} en comisiones por {compras} compras. Para cobrarlas, mandanos tu factura por {monto}{factura}.',
    ctaLabel: 'Ver el detalle',
    variables: ['nombre', 'mes', 'monto', 'compras', 'factura', 'marca'],
  },
  {
    key: 'withdrawal_team',
    code: 'PED-04',
    label: 'Arrepentimiento: aviso al equipo',
    subject: 'Botón de arrepentimiento: pedido #{numero} · {codigo}',
    preheader: 'Hay que coordinar el retiro.',
    body: '{nombre} pidió arrepentirse del pedido #{numero}. Código de trámite: **{codigo}**.\n\nContacto: {contacto}\n\nMotivo: {motivo}\n\nHay que escribirle para coordinar el retiro, sin costo para ella.',
    ctaLabel: 'Ver en el panel',
    variables: ['nombre', 'numero', 'codigo', 'contacto', 'motivo', 'marca'],
  },
]

export const emailTemplateDef = (key: string) => EMAIL_TEMPLATES.find((t) => t.key === key)

/** EM-04: the reason, by what happened. */
export const CANCEL_REASONS = {
  transfer_expired: 'No recibimos la transferencia a tiempo.',
  payment_expired: 'No recibimos el pago a tiempo.',
  customer: 'Lo pediste vos.',
  stock: 'No tenemos stock.',
  team: 'Lo cancelamos desde la tienda.',
} as const
export type CancelReason = keyof typeof CANCEL_REASONS
