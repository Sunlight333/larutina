// Art direction for every generated image in the demo. Packshots share one
// studio setup so the 18 products read as a single shoot; everything else is
// one campaign (below): one apartment, one light, the same three models.

export const BRANDS = {
  'aurea-lab': {
    name: 'Aurea Lab',
    label:
      'a clean clinical white label with minimalist black sans-serif typography; the brand name "AUREA LAB" is set in small, widely letter-spaced capitals',
  },
  'nube-skin': {
    name: 'Nube Skin',
    label:
      'soft rounded lowercase sans-serif typography printed directly on the pack; the brand name "nube skin" is set in lowercase',
  },
  'mar-de-sal': {
    name: 'Mar de Sal',
    label:
      'an elegant high-contrast serif logotype "Mar de Sal" printed directly on the pack in white or deep navy, with the product name in small sans-serif capitals below',
  },
  'verde-raiz': {
    name: 'Verde Raíz',
    label:
      'an uncoated cream paper label with a classic serif logotype "VERDE RAÍZ" in small capitals and a tiny fine-line root illustration',
  },
  'clara-botanica': {
    name: 'Clara Botánica',
    label:
      'a refined thin serif logotype "Clara Botánica" with a delicate single-line leaf motif, printed in warm charcoal',
  },
}

// pack: what the object is. text: the product line printed under the brand.
// backdrop: seamless paper colour, also stored as Product.color.
export const PRODUCTS = [
  { n: 1, slug: 'gel-limpiador-purificante', brand: 'mar-de-sal', text: 'Gel limpiador purificante', pack: 'a 200 ml matte sea-glass green plastic bottle with a white pump dispenser', backdrop: 'pale sea-glass green', hex: '#D6E3DC' },
  { n: 2, slug: 'crema-limpiadora-suave', brand: 'clara-botanica', text: 'Crema limpiadora suave', pack: 'a 150 ml soft ivory squeeze tube standing upright on its pale sage flip-top cap', backdrop: 'warm oat cream', hex: '#EDE4D6' },
  { n: 3, slug: 'espuma-limpiadora-equilibrante', brand: 'nube-skin', text: 'espuma limpiadora', pack: 'a 150 ml frosted pale powder-blue foaming pump bottle with a rounded white foam pump head', backdrop: 'pale powder blue', hex: '#DCE5EE' },
  { n: 4, slug: 'tonico-hidratante', brand: 'nube-skin', text: 'tónico hidratante', pack: 'a 200 ml translucent frosted bottle holding pale lilac liquid, with a rounded white screw cap', backdrop: 'pale lilac', hex: '#E4DFEC' },
  { n: 5, slug: 'tonico-calmante-centella', brand: 'verde-raiz', text: 'Tónico calmante de centella', pack: 'a 200 ml green glass bottle with a matte black screw cap', backdrop: 'soft sage green', hex: '#DDE3D3' },
  { n: 6, slug: 'exfoliante-liquido-aha-7', brand: 'aurea-lab', text: 'Exfoliante AHA 7%', pack: 'a 100 ml clear glass bottle holding clear liquid, with a white screw cap', backdrop: 'pale apricot', hex: '#F0DFD0' },
  { n: 7, slug: 'exfoliante-bha-2', brand: 'mar-de-sal', text: 'Exfoliante BHA 2%', pack: 'a 120 ml matte slate-blue plastic bottle with a white flip-top cap', backdrop: 'misty blue-grey', hex: '#D9DFE6' },
  { n: 8, slug: 'serum-niacinamida-10-zinc', brand: 'aurea-lab', text: 'Niacinamida 10% + Zinc', pack: 'a 30 ml frosted glass dropper bottle with a black rubber bulb', backdrop: 'warm light stone grey', hex: '#E3E0DB' },
  { n: 9, slug: 'serum-vitamina-c-15', brand: 'aurea-lab', text: 'Vitamina C 15%', pack: 'a 30 ml amber glass dropper bottle with a black rubber bulb', backdrop: 'soft pale marigold', hex: '#F1DEC2' },
  { n: 10, slug: 'serum-acido-hialuronico', brand: 'nube-skin', text: 'ácido hialurónico', pack: 'a 30 ml frosted pale ice-blue glass dropper bottle with a white rubber bulb', backdrop: 'pale ice blue', hex: '#DDE8EE' },
  { n: 11, slug: 'serum-acido-azelaico-10', brand: 'clara-botanica', text: 'Sérum ácido azelaico 10%', pack: 'a 30 ml slim opaque ivory airless pump bottle with a blush-pink pump collar', backdrop: 'soft blush pink', hex: '#F0DCD8' },
  { n: 12, slug: 'retinol-03-escualano', brand: 'verde-raiz', text: 'Retinol 0.3% en escualano', pack: 'a 30 ml dark amber glass dropper bottle with a matte black bulb', backdrop: 'dusty lavender mauve', hex: '#DED6E0' },
  { n: 13, slug: 'gel-crema-ligero', brand: 'nube-skin', text: 'gel crema ligero', pack: 'a 50 ml frosted mint-green glass jar with a smooth rounded white lid', backdrop: 'pale mint', hex: '#DCEAE2' },
  { n: 14, slug: 'crema-reparadora-barrera', brand: 'clara-botanica', text: 'Crema reparadora de barrera', pack: 'a 50 ml ivory ceramic-look cosmetic jar with a warm sand-coloured lid', backdrop: 'warm sand beige', hex: '#E9DFD2' },
  { n: 15, slug: 'crema-con-peptidos', brand: 'verde-raiz', text: 'Crema con péptidos', pack: 'a 50 ml dusty rose glass cosmetic jar with a matte black lid', backdrop: 'dusty rose', hex: '#EBD9D9' },
  { n: 16, slug: 'fluido-protector-fps-50', brand: 'mar-de-sal', text: 'Fluido protector FPS 50', pack: 'a 50 ml matte butter-yellow squeeze tube standing upright on its white cap', backdrop: 'pale butter yellow', hex: '#F2E7C9' },
  { n: 17, slug: 'protector-mineral-fps-50', brand: 'clara-botanica', text: 'Protector mineral FPS 50', pack: 'a 50 ml soft peach squeeze tube standing upright on its ivory cap', backdrop: 'soft peach', hex: '#F3DCCD' },
  { n: 18, slug: 'mascarilla-de-arcilla', brand: 'mar-de-sal', text: 'Mascarilla de arcilla', pack: 'a 100 g wide low matte terracotta-pink jar with a white lid', backdrop: 'pale clay pink', hex: '#EDD5CB' },
]

export function packshotPrompt(p) {
  const b = BRANDS[p.brand]
  return [
    `Professional studio packshot for a premium skincare e-commerce catalog.`,
    `A single product: ${p.pack}, standing upright, centered in the frame, filling about 60% of the image height.`,
    `The packaging design uses ${b.label}. Under the brand name, the product name reads exactly "${p.text}" in a smaller size. No other text on the pack except a tiny volume mark.`,
    `Seamless paper sweep backdrop in a ${p.backdrop} tone (${p.hex}); the floor and the wall are the same colour with no visible horizon line.`,
    `Soft diffused morning daylight from the left, a gentle soft shadow falling to the right, a subtle natural highlight along the pack.`,
    `Straight-on camera at product height, 100mm macro lens, everything in sharp focus, photorealistic, restrained, calm, luxurious but understated.`,
    `No props, no plants, no water, no people, no additional products, no watermark.`,
  ].join(' ')
}

// The campaign. Every photograph on the site outside the product displays
// comes from one shoot: one sunlit apartment, one palette, one light and the
// same three models, so the images read as a single campaign. The first hero
// establishes the cast; every later image gets a sheet of their faces
// (images-raw/cast.png) as a reference so they stay the same women.

const WORLD =
  'The set is a sunlit, airy apartment in Buenos Aires styled for a skincare campaign: warm limewashed plaster walls in cream and soft peach, tall French windows with sheer ivory linen curtains glowing in the light, a honed travertine vanity and low travertine benches, clear glass vases with olive branches and a few pale peach garden roses, clear glass spheres and water glasses that throw rippling caustic light across the surfaces, soft palm-leaf shadows on the walls. Palette: cream, ivory, peach, blush, apricot, warm sand and soft gold, with small touches of sage green. Luminous, softly filmic colour with creamy highlights.'

const CAST = {
  sofia: 'Sofía, with long glossy dark-brown waves, warm olive skin and dark brown eyes',
  valentina: 'Valentina, with honey-blonde shoulder-length hair in a soft wave, light skin with a few faint freckles and hazel eyes',
  maia: 'Maia, with deep brown skin, high cheekbones and short defined dark curls',
}

const BEAUTY =
  'Every woman is strikingly beautiful and aged 22 to 26, with luminous, dewy, healthy glowing skin: flawless, even and radiant, the result the products promise, with real fine skin texture, fresh minimal makeup, glossy lips and natural brows.'

const PRODUCT_FIDELITY =
  'Each product appears exactly once and is identical to its reference image in shape, colour, material, proportions and label typography, held with the label facing the camera, legible and in crisp focus. Never duplicate a product and never add other products or packaging.'

const QUALITY =
  'Luxury beauty advertising campaign photograph for a skincare store, shot by a top fashion photographer on a medium-format camera, magazine quality, photorealistic, natural anatomy with correct hands and fingers. No text overlays, no watermark, no extra logos.'

const CAST_REFERENCE =
  'Reference image 1 is the cast sheet: Sofía on the left, Valentina in the middle, Maia on the right. Keep each woman exactly as she appears there: same face, hair, skin tone and features. The dab of cream on the cheek of Maia belongs to that one photograph only.'

// The group sits in the right half, so the headline can use the left half on
// desktop and a 4:5 crop of that half carries the whole group on phones.
const GROUP_FRAME =
  'Landscape composition: the three women form a close, dynamic group in the right half of the frame, from about 50% to 96% of the width, close enough that faces and products read large, with comfortable headroom and all faces in the upper half of the frame. Each woman is in a different pose and at a different height, interacting like close friends. The left half of the frame is the same room with no people and no products: bright, calm, low in contrast and softly out of focus, leaving clean space for a headline. All three faces and all products are in sharp focus.'

export const CAMPAIGNS = {
  'hero-1': {
    aspect: '16:9',
    cast: false,
    refs: ['serum-vitamina-c-15', 'fluido-protector-fps-50', 'crema-reparadora-barrera'],
    prompt: `Scene: morning at the long travertine vanity in front of the tall window, the sheer curtains glowing with warm golden sunlight from the left, a glass vase of olive branches and peach roses on the vanity, caustic light rippling across the travertine and the wall. Reference image 1 is the amber dropper bottle ("AUREA LAB / Vitamina C 15%"), reference image 2 the butter-yellow squeeze tube ("Mar de Sal / Fluido protector FPS 50"), reference image 3 the ivory jar with the sand lid ("Clara Botánica / Crema reparadora de barrera"). The three women are ${CAST.valentina}; ${CAST.sofia}; and ${CAST.maia}. Within the group, from left to right: Valentina, in an ivory linen shirt, sits sideways on the edge of the vanity holding the amber dropper bottle up beside her cheek with the pipette lifted, smiling softly at the camera; Sofía, in a pale blue cotton shirt worn open over a white tank, leans on the vanity on her forearms in front of the others, chin resting on one hand like a magazine cover, holding the butter-yellow tube upright in her other hand; Maia, in a sand silk slip dress, stands behind them laughing, holding the open ivory jar at chest height with a swipe of cream on her fingertip.`,
  },
  'hero-2': {
    aspect: '16:9',
    cast: true,
    refs: ['serum-acido-hialuronico', 'tonico-hidratante', 'gel-crema-ligero'],
    prompt: `Scene: late morning in the living area of the same apartment: a low curved cream bouclé sofa and a travertine coffee table beside the sheer-curtained window, a clear glass bowl of water and glass spheres throwing caustic light, soft palm-leaf shadows on the peach plaster wall, warm sunlight from the left. ${CAST_REFERENCE} Reference image 2 is the frosted ice-blue dropper bottle ("nube skin / ácido hialurónico"), reference image 3 the frosted lilac bottle ("nube skin / tónico hidratante"), reference image 4 the frosted mint-green jar ("nube skin / gel crema ligero"). Within the group, from left to right: Maia, in a white ribbed tank, perches on the arm of the sofa holding the lilac bottle toward the camera; Sofía, in an ivory satin top, lies across the sofa on her front, propped on her elbows, holding the ice-blue dropper bottle beside her cheek and looking into the camera; Valentina, in a soft peach knit, sits behind her with an arm around her shoulders, holding the open mint-green jar and laughing.`,
  },
  'hero-3': {
    aspect: '16:9',
    cast: true,
    refs: ['tonico-calmante-centella', 'crema-con-peptidos', 'retinol-03-escualano'],
    prompt: `Scene: golden hour on the apartment's terrace: limewashed peach plaster walls with a rounded arch, potted olive trees, a travertine bench, warm low sunlight from the left with a gentle flare, long soft palm-leaf shadows. ${CAST_REFERENCE} Reference image 2 is the green glass bottle with the black cap ("VERDE RAÍZ / Tónico calmante de centella"), reference image 3 the dusty rose jar with the black lid ("VERDE RAÍZ / Crema con péptidos"), reference image 4 the dark amber dropper bottle ("VERDE RAÍZ / Retinol 0.3% en escualano"). Within the group, from left to right: Sofía, in a sage silk dress, sits on the travertine bench holding the green glass bottle toward the camera; Valentina, in a dusty rose satin shirt, sits beside her with her head resting on Sofía's shoulder, holding the open dusty rose jar; Maia, in ivory linen, stands leaning against the arch and lifts the dark amber dropper bottle at eye level, the glass glowing in the golden light.`,
  },
}

export function campaignPrompt(name) {
  const c = CAMPAIGNS[name]
  const frame = c.frame ?? (c.aspect === '16:9' ? GROUP_FRAME : SOLO_FRAME)
  return [c.prompt, frame, WORLD, c.stillLife ? STILL_LIFE : BEAUTY, c.stillLife ? '' : PRODUCT_FIDELITY, QUALITY].filter(Boolean).join(' ')
}

// Single portraits for the concern cards, the menu, the routine panels and the
// product showcase: one of the cast, one product, the same apartment and light.
const SOLO_FRAME =
  'Portrait composition: one woman framed from the chest up, her face in the upper half of the frame, the product held near her face with the label facing the camera, the room behind her softly out of focus. Face and product in sharp focus.'

const solo = (who, product, label, scene) => ({
  aspect: '4:5',
  cast: true,
  refs: [product],
  prompt: `${scene} Reference image 1 is the cast sheet: Sofía on the left, Valentina in the middle, Maia on the right. The woman in this photograph is ${who}: keep her exactly as she appears there, with the same face, hair, skin tone and features, without the dab of cream from the sheet. Reference image 2 is the product she holds (${label}).`,
})

Object.assign(CAMPAIGNS, {
  acne: solo('Sofía', 'exfoliante-bha-2', '"Mar de Sal / EXFOLIANTE BHA 2%"', 'Sofía stands by the tall window in a white ribbed tank, her skin clear, smooth and softly matte with a fresh glow, holding the slate-blue bottle beside her cheek with a relaxed, confident smile. Sheer curtains glow behind her and palm-leaf shadows fall across the peach plaster.'),
  manchas: solo('Valentina', 'serum-acido-azelaico-10', '"Clara Botánica / Sérum ácido azelaico 10%"', 'Valentina in an ivory linen shirt, her skin perfectly even and luminous in the warm sunlight, a few faint freckles, holds the slim ivory airless bottle with the blush-pink collar beside her cheek, eyes to the camera. Olive branches and peach roses in a glass vase are softly out of focus behind her.'),
  deshidratacion: solo('Maia', 'tonico-hidratante', '"nube skin / tónico hidratante"', 'Maia sits on the cream bouclé sofa in a white satin top, her skin plump, dewy and glass-like, catching the light, holding the frosted lilac bottle beside her face and laughing softly. Caustic water reflections ripple across the plaster wall behind her.'),
  sensibilidad: solo('Valentina', 'tonico-calmante-centella', '"VERDE RAÍZ / Tónico calmante de centella"', 'Valentina in a sage silk slip rests her cheek on one hand, her skin calm, even and comfortable with no redness, holding the green glass bottle with the black cap in her other hand with a serene smile. A glass bowl with a few round centella leaves sits on the travertine beside her.'),
  lineas: solo('Maia', 'crema-con-peptidos', '"VERDE RAÍZ / Crema con péptidos"', 'Maia in an ivory linen shirt at the travertine vanity, her skin smooth, firm and radiant, holds the open dusty rose jar with a touch of cream on her fingertip, looking into the camera with a warm smile.'),
  poros: solo('Sofía', 'mascarilla-de-arcilla', '"Mar de Sal / MASCARILLA DE ARCILLA"', 'Sofía in a soft peach knit, her hair in a loose low bun and her complexion smooth and refined with a healthy glow, holds the open wide terracotta-pink jar at cheek level, smiling at the camera.'),
  manana: solo('Sofía', 'fluido-protector-fps-50', '"Mar de Sal / Fluido protector FPS 50"', 'Bright morning at the vanity by the window: Sofía in a pale blue cotton shirt dots sunscreen onto her cheekbone with one finger while holding the butter-yellow tube in her other hand, fresh and glowing, crisp palm-leaf shadows and clean morning sun.'),
  noche: solo('Maia', 'retinol-03-escualano', '"VERDE RAÍZ / Retinol 0.3% en escualano"', 'Evening in the same apartment: the window behind her shows a deep dusk blue, warm light comes from a small travertine table lamp and a candle on the vanity. Maia in a dusty rose satin robe lets a drop fall from the dark amber dropper onto her fingertips, calm and radiant, a warm amber glow on her skin.'),
  ficha: solo('Valentina', 'serum-niacinamida-10-zinc', '"AUREA LAB / Niacinamida 10% + Zinc"', 'Valentina in a white tank holds the frosted glass dropper bottle with the black bulb toward the camera, a single drop of serum on the fingertip of her other hand, her skin luminous and refined in warm sunlight.'),
  diagnostico: solo('Sofía', 'gel-crema-ligero', '"nube skin / gel crema ligero"', 'Sofía at the travertine vanity gently touches her cheek with her fingertips as if reading her skin, smiling at the camera, holding the frosted mint-green jar in her other hand, sheer curtains glowing behind her.'),
})

// The brand band: the products alone on the set, as the campaign's still life.
const STILL_LIFE =
  'No people and no hands. Each product appears exactly once and is identical to its reference image in shape, colour, material, proportions and label typography, standing upright with its label facing the camera, legible and in crisp focus. Never duplicate a product and never add other products or packaging.'

CAMPAIGNS.bodegon = {
  aspect: '21:9',
  cast: false,
  stillLife: true,
  frame: '',
  refs: ['serum-vitamina-c-15', 'crema-reparadora-barrera', 'fluido-protector-fps-50', 'serum-acido-hialuronico', 'tonico-calmante-centella'],
  prompt:
    'Still life for the same campaign: the long honed travertine vanity in front of the sheer-curtained window in warm golden morning sunlight. The five products from the reference images (an amber dropper bottle "AUREA LAB / Vitamina C 15%", an ivory jar "Clara Botánica / Crema reparadora de barrera", a butter-yellow tube "Mar de Sal / Fluido protector FPS 50", a frosted ice-blue dropper bottle "nube skin / ácido hialurónico", a green glass bottle "VERDE RAÍZ / Tónico calmante de centella") stand in a relaxed, close group on two low travertine blocks in the right third of the frame, filling about half of the image height, so the labels read large. A glass vase of olive branches and peach garden roses and two clear glass spheres beside them throw rippling caustic light across the travertine. The left two thirds of the frame are calm: warm peach limewashed plaster with soft palm-leaf shadows and sunlight, softly out of focus, leaving space for a headline.',
}
