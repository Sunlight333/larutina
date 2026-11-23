import type { PageKind } from '@prisma/client'
import { newBlock, type Block, type PageDoc } from './blocks'
import type { ListRow, ScalarValue } from './fields'

// The content file's copy (A4, client file revision 09/11 with the comments
// of 17/11 and 20/11) as the first version of each page. Applied on top of
// it: "Carrito" for "bolsa" (D-05) and "Tónico" for "toner" (D-15), and
// counts as copy variables (GEN-06: {preguntas}, {rutinas}, {productos}).
// Rows marked FALTA DATO, DECIDIR or PENDIENTE keep their text when it can
// be published as is; otherwise the block is saved hidden, ready to finish
// in the panel. Row codes are noted so each block can be traced back.

const rows = <T extends Record<string, ScalarValue>>(items: T[]) => items.map((it, i) => ({ _id: `r${i + 1}`, ...it }) as T & ListRow)

export type SeedPage = { slug: string; kind: PageKind; doc: PageDoc }

const homeBlocks: Block[] = [
  // H-01 to H-04. No photo yet (prompt P-H01): the hero shows text only until one is uploaded.
  newBlock('hero', 'hero', {
    title: 'Cuidar tu piel es tu rutina',
    subtitle: 'Respondé {preguntas} preguntas y armamos tu rutina de mañana y de noche. Cada producto viene con el motivo por el que lo elegimos.',
    cta1Label: 'Hacer mi diagnóstico',
    cta1Href: '/diagnostico',
    cta2Label: 'Ver productos',
    cta2Href: '/productos',
    note: 'Sin registrarte · Unos tres minutos',
    focusDesktop: { x: 62, y: 35 },
    focusMobile: { x: 50, y: 30 },
  }),
  // H-05: three photos still to make (P-H02 to P-H04); hidden until they are uploaded.
  newBlock(
    'carousel',
    'carrusel',
    {
      slides: rows([
        { imageDesktop: '', imageMobile: '', alt: 'Tres mujeres de distintas edades junto a una ventana, cada una con un producto de su rutina de mañana.', text: '', href: '' },
        { imageDesktop: '', imageMobile: '', alt: 'Una mujer de unos 50 años se pone sérum frente al espejo del baño, sin maquillaje.', text: '', href: '' },
        { imageDesktop: '', imageMobile: '', alt: 'Dos amigas se ríen en la cocina con el tónico de la mañana en la mano.', text: '', href: '' },
      ]),
    },
    false,
  ),
  // H-06
  newBlock('features', 'lo-que-hacemos', {
    items: rows([
      { title: 'Diagnóstico en tres minutos', text: '{preguntas} preguntas, sin registrarte.', image: '' },
      { title: 'Cada paso, en su orden', text: 'Limpiar, tratar y proteger, sin pasos de más.', image: '' },
      { title: 'El porqué de cada producto', text: 'Te contamos qué hace cada activo y para qué piel es.', image: '' },
      { title: 'Activos que conviven', text: 'Separamos los que no van juntos en la misma rutina.', image: '' },
    ]),
  }),
  // H-07 to H-09. Cards come from the catalog's needs, in the order of Configuración › Listado.
  newBlock('needs', 'necesidades', { eyebrow: 'Comprar por necesidad', title: '¿Qué te gustaría mejorar?', ctaLabel: 'Ver todos los productos', ctaHref: '/productos' }),
  // H-10 to H-12. Photo P-H11 and the products on it are still to choose.
  newBlock('imageText', 'criterio', {
    eyebrow: 'Nuestro criterio',
    title: 'Productos de marcas coreanas. Elegidos uno por uno.',
    body: 'Cada producto está acá por lo que lleva y por la piel para la que sirve. Te decimos para qué es, cómo usarlo y con qué no combinarlo. Y también lo que no hace.',
    imageSide: 'right',
  }),
  // H-13
  newBlock('diagnosis', 'vista-previa-diagnostico', { variant: 'preview', ctaLabel: 'Hacer mi diagnóstico', ctaHref: '/diagnostico' }),
  // H-14 to H-16
  newBlock('features', 'dos-momentos', {
    title: 'Dos momentos, dos rutinas',
    text: 'Tu piel no necesita lo mismo a la mañana que a la noche.',
    items: rows([
      { title: 'Tu rutina de mañana', text: 'Limpiar, preparar y proteger la piel para todo el día. De tres a cinco pasos.', image: '' },
      { title: 'Tu rutina de noche', text: 'Tratar y reparar mientras dormís, sin mezclar activos que no van juntos. De tres a cinco pasos.', image: '' },
    ]),
  }),
  // H-17 to H-19. "pensadas", not "probadas", until the dermatologist validates them (note on H-17).
  newBlock('routines', 'rutinas', {
    eyebrow: 'Rutinas armadas',
    title: 'Si preferís empezar por una rutina ya pensada.',
    text: '{rutinas} combinaciones pensadas para las necesidades más comunes, con todos sus pasos.',
    ctaLabel: 'Ver las rutinas',
    ctaHref: '/rutinas',
  }),
  // H-20, H-21
  newBlock('features', 'ficha', {
    title: 'Así se ve una ficha',
    text: 'Cada producto, explicado como lo haría una asesora. Todo lo que necesitás para elegir, en el orden en que lo preguntarías.',
    items: rows([
      { title: 'Ingredientes estrella', text: 'Qué hace cada uno y en qué concentración.', image: '' },
      { title: 'Para qué piel es', text: 'Para cuál es ideal y para cuál no.', image: '' },
      { title: 'Dónde va en tu rutina', text: 'Cuándo, cuánto y en qué paso.', image: '' },
      { title: 'Con qué no combinarlo', text: 'Lo calculamos a partir de sus activos.', image: '' },
    ]),
  }),
  // H-22. Products: Configuración › Listado › Productos destacados.
  newBlock('featured', 'para-empezar', { title: 'Para empezar', ctaLabel: 'Ver todos los productos', ctaHref: '/productos' }),
  // H-23, H-24
  newBlock('howItWorks', 'como-funciona', {
    title: 'Cómo funciona',
    text: 'Tres minutos, y una rutina que se explica sola. Detrás de cada recomendación hay datos de cada producto: para qué piel es, sobre qué trabaja, qué activos lleva y con cuáles no combina.',
    steps: rows([
      { title: 'Contás cómo es tu piel', text: 'Brillo, granitos, sensibilidad y lo que querés mejorar. Una pregunta por pantalla.' },
      { title: 'Cruzamos cada producto', text: 'Para qué piel es ideal, sobre qué trabaja y con qué no combina. Si estás embarazada o es tu primera vez con activos fuertes, los dejamos afuera.' },
      { title: 'Recibís tu rutina, con el porqué', text: 'De mañana y de noche, lista para sumar a tu carrito.' },
    ]),
  }),
  // H-25 (FALTA DATO): hidden until the programme is defined.
  newBlock(
    'ambassadors',
    'embajadoras',
    {
      eyebrow: 'Embajadoras',
      title: 'Profesionales que te recomiendan con criterio.',
      text: 'Cosmetólogas y esteticistas que conocen cada producto y te ayudan a elegir. Si trabajás con la piel de otras personas, sumate.',
      ctaLabel: 'Conocé el programa',
      ctaHref: '/embajadoras',
    },
    false,
  ),
  // H-26: the only dark block.
  newBlock('diagnosis', 'cierre', {
    variant: 'dark',
    title: 'Tu piel cambia de la mañana a la noche. Tu rutina, también.',
    text: '{preguntas} preguntas y la tenés armada, con el porqué de cada paso.',
    ctaLabel: 'Hacer mi diagnóstico',
    ctaHref: '/diagnostico',
  }),
  // H-27 points to G-17, which the footer already shows right below; hidden so the Home does not ask twice.
  newBlock('newsletter', 'newsletter', {}, false),
]

const nosotrasBlocks: Block[] = [
  // NO-01, NO-02. Photo P-NO01 still to make.
  newBlock('hero', 'nosotras-hero', {
    title: 'Cuidarte no debería ser complicado.',
    subtitle: 'Somos Larutina: elegimos skincare coreano para la piel latina y te explicamos cómo usarlo, sin rutinas imposibles ni promesas que no se cumplen.',
  }),
  // NO-03
  newBlock('richText', 'como-empezo', {
    title: 'Cómo empezó',
    body: 'Larutina nace de una forma de entender el cuidado que compartimos sus fundadoras. Somos mujeres con trabajo, hobbies, familia y poco tiempo, y en el skincare encontramos lo mismo que muchas: demasiados productos, demasiadas tendencias y recomendaciones que se contradicen. Quisimos hacerlo más simple, profesional y personalizado.\n\nSomos mujeres reales con necesidades reales.',
  }),
  // NO-04
  newBlock('richText', 'que-es-una-rutina', {
    title: 'Qué es una rutina para nosotras',
    body: 'Para nosotras, la rutina es más que skincare: son esos pequeños hábitos que sostenés para sentirte bien. Cuidar la piel es uno. Creemos más en lo simple y constante que en lo perfecto.',
  }),
  // NO-05
  newBlock('richText', 'amiga-y-dermatologa', {
    title: 'Entre una amiga y una dermatóloga',
    body: 'Queremos estar en el medio: la cercanía de una amiga que te recomienda lo que le funcionó, con el criterio de alguien que sabe por qué funciona. Te hablamos claro, te decimos qué hace cada producto y también qué no hace.',
  }),
  // NO-06
  newBlock('features', 'como-trabajamos', {
    title: 'Cómo trabajamos',
    items: rows([
      { title: 'Curaduría', text: 'Pocos productos, elegidos uno por uno por lo que llevan.', image: '' },
      { title: 'Diagnóstico', text: '{preguntas} preguntas para que la rutina sea para tu piel.', image: '' },
      { title: 'Rutinas simples', text: 'Los pasos justos, en el orden correcto.', image: '' },
      { title: 'Acompañamiento', text: 'Después de la compra seguimos: por WhatsApp y en tu cuenta.', image: '' },
    ]),
  }),
  // NO-07 (DECIDIR): only with the alliance signed; hidden until then.
  newBlock(
    'richText',
    'respaldo-profesional',
    { title: 'Respaldo profesional', body: '[Solo con la alianza firmada] Trabajamos con [Dra. Nombre], dermatóloga, que revisa nuestra curaduría y nuestras rutinas.' },
    false,
  ),
  // NO-08
  newBlock('richText', 'lo-que-no-hacemos', {
    title: 'Lo que no hacemos',
    body: 'No vendemos todo lo que existe. No te apuramos con ofertas que se terminan. No te prometemos piel perfecta.',
  }),
  // NO-09
  newBlock('diagnosis', 'nosotras-cierre', { variant: 'dark', title: '¿Empezamos por tu piel?', ctaLabel: 'Hacer mi diagnóstico', ctaHref: '/diagnostico' }),
]

const faq = (id: string, title: string, items: { question: string; answer: string }[], enabled: boolean) => newBlock('faq', id, { title, items: rows(items) }, enabled)

const faqBlocks: Block[] = [
  // AY-05 (FALTA DATO: delivery times and free-shipping threshold).
  faq(
    'faq-envios',
    'Pedidos y envíos',
    [
      { question: '¿Cuánto tarda mi pedido?', answer: 'En CABA y GBA, de [X a X] días hábiles; en el resto del país, de [X a X]. Te mandamos el seguimiento cuando sale.' },
      { question: '¿Cuánto cuesta el envío?', answer: 'Se calcula con tu código postal en el carrito. [Envío gratis desde $X].' },
      { question: '¿Puedo cambiar la dirección?', answer: 'Sí, si todavía no lo despachamos. Escribinos por WhatsApp con tu número de pedido.' },
    ],
    false,
  ),
  // AY-06 (DECIDIR: transfer discount, invoicing; still mentions MODO, which D-02 left out).
  faq(
    'faq-pagos',
    'Pagos',
    [
      { question: '¿Qué medios de pago aceptan?', answer: 'Mercado Pago (tarjetas de crédito, débito y dinero en cuenta), MODO (tarjetas de crédito) y transferencia bancaria, que tiene {descuento_transferencia}% de descuento.' },
      { question: '¿Puedo pagar en cuotas?', answer: 'Sí, según tu banco y la promo vigente; las ves en Mercado Pago antes de pagar.' },
      { question: '¿Hacen factura?', answer: '[PENDIENTE: situación fiscal].' },
    ],
    false,
  ),
  // AY-07 (DECIDIR: origin of the products still to describe).
  faq(
    'faq-productos',
    'Productos',
    [
      { question: '¿Los productos son originales?', answer: "Sí. [PENDIENTE: describir el origen tal cual es: p. ej. 'Los traemos de Corea a través de un distribuidor autorizado']." },
      { question: '¿Tienen vencimiento?', answer: 'Sí. La fecha y el tiempo de uso después de abierto (el frasquito abierto con un número y una M) están en el envase.' },
      { question: '¿Tienen un registro en ANMAT?', answer: 'Sí. Todos los productos que comercializamos tienen registro ante el ANMAT.' },
    ],
    false,
  ),
  // AY-08
  faq(
    'faq-diagnostico',
    'Diagnóstico y rutinas',
    [
      { question: '¿Tengo que hacer el diagnóstico para comprar?', answer: 'No. Te lo recomendamos antes de la primera compra para no gastar en algo que no es para tu piel.' },
      { question: '¿Puedo repetirlo?', answer: 'Sí, las veces que quieras. Con cuenta, guardamos cada resultado.' },
      { question: '¿Las rutinas completas tienen descuento?', answer: 'Sí. Llevando la rutina completa tenés un descuento, que ves en el carrito antes de pagar.' },
      { question: '¿Es un diagnóstico médico?', answer: 'No. Si tenés una condición de la piel, consultá con una dermatóloga.' },
    ],
    true,
  ),
  // AY-09: hidden while the ambassador programme (H-25) is not open.
  faq(
    'faq-embajadoras',
    'Embajadoras',
    [
      { question: '¿Qué es una embajadora?', answer: 'Una profesional de la piel que recomienda Larutina con su criterio. Si llegaste por su link, su código ya queda cargado.' },
      { question: '¿Cómo me sumo?', answer: 'Si sos cosmetóloga, esteticista o dermatóloga, postulate en Embajadoras.' },
    ],
    false,
  ),
  // AY-10 (DECIDIR: exchange window and legal review).
  faq(
    'faq-devoluciones',
    'Cambios y devoluciones',
    [
      { question: '¿Puedo devolver un producto?', answer: 'Sí. Tenés 10 días corridos desde que lo recibís para arrepentirte de la compra, sin dar motivo y sin costo. Usá el Botón de arrepentimiento.' },
      { question: '¿Y si me llegó dañado o equivocado?', answer: 'Escribinos con una foto y lo resolvemos.' },
      { question: '¿Puedo cambiarlo por otro?', answer: 'Sí, si está cerrado y sin uso, dentro de los [X] días.' },
    ],
    false,
  ),
]

const shippingBlocks: Block[] = [
  // AY-11, without its reference times, which are still [X a X] (next block).
  newBlock('richText', 'envios', {
    title: 'Envíos',
    body: 'Enviamos a toda Argentina. Al poner tu código postal te mostramos los correos disponibles, el costo y el plazo. Te mandamos el número de seguimiento por email apenas sale.',
  }),
  newBlock('richText', 'envios-plazos', { title: 'Plazos de referencia', body: 'Como referencia, CABA y GBA: [X a X] días hábiles; resto del país: [X a X] días hábiles.' }, false),
  // AY-12: a draft with legal sources, to be reviewed by a lawyer before publishing (its note).
  newBlock(
    'richText',
    'arrepentimiento',
    {
      title: 'Arrepentimiento',
      body: 'Podés arrepentirte de tu compra dentro de los 10 días corridos desde que la recibís, sin dar motivo. Usá el [Botón de arrepentimiento](/arrepentimiento) (no hace falta tener cuenta) o escribinos. En 24 horas te mandamos un código de trámite. El envío de vuelta lo pagamos nosotras y te devolvemos el dinero por el mismo medio de pago. Pedimos que nos devuelvas el producto como lo recibiste.',
    },
    false,
  ),
  // AY-13 (X días pending).
  newBlock(
    'richText',
    'producto-danado',
    { title: 'Producto dañado o equivocado', body: 'Si te llegó un producto dañado o distinto al que pediste, lo cambiamos o te devolvemos el dinero. [Escribinos](/contacto) dentro de los X días con una foto.' },
    false,
  ),
  // AY-14 (refund time pending).
  newBlock(
    'richText',
    'paso-a-paso',
    {
      title: 'Paso a paso',
      body: '1. Tocá el Botón de arrepentimiento o escribinos con tu número de pedido.\n2. En 24 horas te mandamos tu código de trámite y cómo seguir.\n3. Coordinamos la devolución sin costo.\n4. Cuando recibimos el producto, te devolvemos el dinero por el mismo medio en [PENDIENTE: plazo] días hábiles.',
    },
    false,
  ),
]

export const SEED_PAGES: SeedPage[] = [
  {
    slug: 'inicio',
    kind: 'HOME',
    // H-28
    doc: {
      title: 'Home',
      seoTitle: 'Larutina Beauty · Skincare coreano con diagnóstico de piel',
      seoDescription: 'Hacé el diagnóstico y recibí tu rutina de mañana y de noche con productos seleccionados exclusivamente, y el motivo de cada uno.',
      blocks: homeBlocks,
    },
  },
  // NO-10
  { slug: 'nosotras', kind: 'INSTITUTIONAL', doc: { title: 'Nosotras', seoTitle: '', seoDescription: 'Por qué elegimos pocos productos y cómo los evaluamos.', blocks: nosotrasBlocks } },
  // AY-15
  { slug: 'preguntas-frecuentes', kind: 'HELP', doc: { title: 'Preguntas frecuentes', seoTitle: '', seoDescription: '', blocks: faqBlocks } },
  { slug: 'envios-y-devoluciones', kind: 'HELP', doc: { title: 'Envíos y devoluciones', seoTitle: '', seoDescription: '', blocks: shippingBlocks } },
]

// JO-02 ("Detrás de la curaduría" became "Cómo elegimos").
export const SEED_ARTICLE_CATEGORIES = [
  { slug: 'ingredientes', name: 'Ingredientes' },
  { slug: 'rutinas', name: 'Rutinas' },
  { slug: 'tipos-de-piel', name: 'Tipos de piel' },
  { slug: 'mitos-y-verdades', name: 'Mitos y verdades' },
  { slug: 'como-elegimos', name: 'Cómo elegimos' },
]

// LE-00: drafts with the law cited, not legal advice; a lawyer reviews them
// before anything is published, so none is published by the seed.
const PENDING = '> **Borrador pendiente de revisión legal.** Texto del archivo de contenido con la norma citada; no es asesoramiento legal. No publicar hasta que lo revise una abogada y estén los datos de la empresa.\n\n'

export const SEED_LEGAL: Record<string, string> = {
  // LE-01
  terminos:
    PENDING +
    [
      '1. Quién vende: [razón social] S.A., CUIT [n], domicilio [x]. Larutina Beauty es su marca.',
      '2. Precios: en pesos, con IVA incluido. Pueden cambiar sin aviso, pero se respeta el precio del momento de la compra.',
      '3. Descuentos: las rutinas completas tienen un descuento que se ve en el carrito. El pago por transferencia suma un descuento extra sobre ese precio. Los códigos de descuento no se suman al descuento de rutina: se aplica el mayor.',
      '4. Pagos: Mercado Pago o transferencia. Las transferencias se reservan 6 horas. No guardamos datos de tarjetas.',
      '5. Envíos: a toda Argentina, con el costo y plazo que ves antes de pagar.',
      '6. Arrepentimiento: 10 días corridos desde la entrega, sin costo (ver Botón de arrepentimiento).',
      '7. Diagnóstico: es una recomendación de productos, no un diagnóstico médico.',
      '8. Reseñas: se publican las de compras verificadas; podemos no publicar las que tengan insultos o datos personales.',
      '9. Propiedad intelectual: textos, fotos y marca son de [razón social] S.A.',
      '10. Ley aplicable: la argentina. Para reclamos: Defensa de las y los Consumidores (Ventanilla Única Federal).',
    ].join('\n'),
  // LE-02
  privacidad:
    PENDING +
    [
      '1. Responsable: [razón social] S.A., [domicilio], [email de privacidad].',
      '2. Qué datos pedimos: nombre, email, teléfono, DNI (para facturar y despachar), direcciones, pedidos, respuestas del diagnóstico y conversaciones de WhatsApp. No pedimos datos de salud: la pregunta sobre retinoides no pregunta el motivo.',
      '3. Para qué: procesar compras y envíos, recomendarte productos, atenderte y, si aceptás, mandarte novedades.',
      '4. Con quién los compartimos: Mercado Pago, Envíopack y el correo que lleve tu pedido, WhatsApp (Meta), [proveedor de hosting] y, si llegaste por una embajadora, ella ve la compra sin tus datos personales.',
      '5. Cuánto tiempo: mientras tengas cuenta; los datos de compras, lo que exija la ley fiscal.',
      '6. Tus derechos: acceder, rectificar y suprimir tus datos escribiendo a [email].',
      "7. Leyendas obligatorias: 'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.' · 'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.'",
    ].join('\n'),
  // AY-12 to AY-14, the help texts on withdrawal and returns.
  'cambios-y-devoluciones':
    PENDING +
    [
      '## Arrepentimiento',
      '',
      'Podés arrepentirte de tu compra dentro de los 10 días corridos desde que la recibís, sin dar motivo. Usá el Botón de arrepentimiento (no hace falta tener cuenta) o escribinos. En 24 horas te mandamos un código de trámite. El envío de vuelta lo pagamos nosotras y te devolvemos el dinero por el mismo medio de pago. Pedimos que nos devuelvas el producto como lo recibiste.',
      '',
      '## Producto dañado o equivocado',
      '',
      'Si te llegó un producto dañado o distinto al que pediste, lo cambiamos o te devolvemos el dinero. Escribinos dentro de los X días con una foto.',
      '',
      '## Paso a paso',
      '',
      '1. Tocá el Botón de arrepentimiento o escribinos con tu número de pedido.',
      '2. En 24 horas te mandamos tu código de trámite y cómo seguir.',
      '3. Coordinamos la devolución sin costo.',
      '4. Cuando recibimos el producto, te devolvemos el dinero por el mismo medio en [PENDIENTE: plazo] días hábiles.',
    ].join('\n'),
  // LE-03
  cookies:
    PENDING +
    "Usamos tres tipos de cookies. Necesarias: hacen que el sitio funcione (carrito, sesión, tu elección de cookies); no se pueden apagar. Analítica (Google Analytics 4): nos dice cuántas personas visitan cada página, sin identificarte. Publicidad (Meta Pixel): mide si nuestros anuncios funcionan y puede mostrarte anuncios de Larutina en otras redes. Analítica y publicidad se activan solo si las aceptás. Podés cambiar tu elección en cualquier momento desde 'Preferencias de cookies' en el pie de página.",
  // LE-05: the programme rules are still a proposal (EB-C01 to EB-C10).
  'programa-embajadoras':
    PENDING +
    'Ver reglas EB-C01 a EB-C10 en Embajadoras v2. Los términos resumen: quién puede ser embajadora, cómo se atribuye una venta, cómo se calcula y paga la comisión, cuándo se cae, qué datos ve, factura y baja.',
}

// G-01 and its note: the free-shipping phrase only exists with a threshold,
// the transfer one with a discount; "en cuotas" never says "sin interés".
export const SEED_ANNOUNCEMENTS = [
  { text: 'Envío gratis desde {envio_gratis_desde}', needs: 'commerce.freeShippingFromCents' as const },
  { text: '{descuento_transferencia}% de descuento pagando por transferencia', needs: 'commerce.transferDiscountPct' as const },
  { text: 'Pagá en cuotas con Mercado Pago', needs: null },
]
