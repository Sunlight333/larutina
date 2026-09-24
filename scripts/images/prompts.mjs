// Art direction for every generated image in the demo. Packshots share one
// studio setup so the 18 products read as a single shoot; textures and
// editorial stills use the same soft morning light from the left.

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

// One macro texture per concern, for the home page tiles.
const TEXTURE_STYLE =
  'Soft diffused morning daylight from the left, very shallow depth of field, photorealistic macro photography for a premium skincare brand, calm and restrained, pale desaturated palette, no text, no logos, no packaging, no hands, no people.'

export const TEXTURES = {
  acne: 'Top-down macro photograph of a clear, lightly aqua-tinted skincare gel spread in one smooth swirl across a pale sea-glass green surface, tiny suspended air bubbles inside the gel, glossy highlights.',
  manchas: 'Macro photograph of glossy golden-amber serum droplets resting on a pale warm cream glass surface, a few perfectly round drops of different sizes and one soft elongated drip, light glowing through the amber liquid.',
  deshidratacion: 'Macro photograph of a translucent hydrating water-gel texture in pale ice-blue, with fine clear water droplets beaded on its glossy surface, gentle ripples.',
  sensibilidad: 'Macro photograph of a soft pale sage-green soothing balm swatch with a smooth creamy stroke, a single fresh round centella asiatica leaf resting beside it on a pale sage surface.',
  lineas: 'Macro photograph of a single smooth, flat stroke of rich ivory face cream swept across a dusty rose surface with a knife-like edge, fine soft ridges in the texture, satin sheen, a small pearl of cream at the end of the stroke.',
  poros: 'Macro photograph of a smooth matte swirl of pale pink kaolin clay mask texture with a fine velvety grain, on a pale clay-pink surface.',
}

export function texturePrompt(slug) {
  return `${TEXTURES[slug]} ${TEXTURE_STYLE}`
}

// Editorial stills are composed from five finished packshots passed as
// reference images, so the products in the scene are the catalog's own.
export const EDITORIAL_REFERENCES = [
  'gel-limpiador-purificante',
  'tonico-calmante-centella',
  'serum-vitamina-c-15',
  'crema-reparadora-barrera',
  'fluido-protector-fps-50',
]

const EDITORIAL_PRODUCTS =
  'The scene contains exactly five objects, one of each product shown in the five reference images. Never duplicate a product. Keep every product identical to its reference: same shape, colour, material, proportions and label typography, with the label text reproduced exactly and legibly: the sea-glass green pump bottle reads "Mar de Sal / GEL LIMPIADOR PURIFICANTE", the green glass bottle reads "VERDE RAÍZ / Tónico calmante de centella", the amber dropper reads "AUREA LAB / Vitamina C 15%", the ivory jar reads "Clara Botánica / Crema reparadora de barrera", the butter-yellow tube reads "Mar de Sal / Fluido protector FPS 50".'

const EDITORIAL_SCENE =
  'Low stepped blocks of pale honed travertine against a warm off-white limewashed plaster wall. Soft early-morning sunlight from the left, long gentle shadows, a faint dappled shadow of palm leaves on the wall. Calm, airy, premium and understated editorial still life, photorealistic, natural colour, crisp detail on the labels. No people, no hands, no props, no extra objects, no text other than the product labels, no watermark.'

export const EDITORIAL = {
  hero: {
    aspect: '4:5',
    prompt: `Portrait editorial still life photograph for the home page of a skincare advice store. ${EDITORIAL_PRODUCTS} Composition: a close, tight group filling the lower 60% of the frame. Back row on the higher block: the green glass bottle on the left and the pump bottle on the right, both labels fully visible. Middle: the amber dropper bottle. Front row on the lower block: the jar on the left and the upright tube on the right. No product may cover another product's label. ${EDITORIAL_SCENE}`,
  },
  'still-life-wide': {
    aspect: '16:9',
    prompt: `Landscape editorial still life photograph for a skincare advice store. ${EDITORIAL_PRODUCTS} Composition: the five products stand in one relaxed row on two travertine blocks, occupying the right two thirds of the frame and filling about 55% of the image height, so the labels are large and sharp. Left to right: pump bottle, green glass bottle, amber dropper, jar, upright tube. The left third is calm empty plaster wall. ${EDITORIAL_SCENE}`,
  },
}

// Campaign imagery: the products advertised by models, for everything on the
// site that is not a product display. Every image is an "after": healthy,
// glowing skin, the result the products promise. Each scene gets the packshot
// it shows as a reference image, so the product is the catalog's own.
const CAMPAIGN_STYLE =
  'High-end beauty campaign photograph for a skincare brand advertisement. The model is a strikingly beautiful woman in her mid-twenties with luminous, healthy, glowing skin: the result the product promises. Fresh natural makeup, real fine skin texture, never plastic. The product from the reference image is the hero of the advertisement: held clearly toward the camera with its label readable, in sharp focus, identical to the reference in shape, colour, material and label typography. Soft, flattering beauty lighting, polished and aspirational, magazine quality, photorealistic. No text overlays, no watermark, no extra logos.'

const HERO_FRAME =
  'Wide composition: the model and the product fill the right 45% of the frame, framed from the shoulders up and turned slightly toward the left. The left 55% of the frame is a clean seamless studio backdrop with a soft, even gradient and nothing else in it: empty space for a headline.'

const PORTRAIT_FRAME = 'Portrait composition, framed from the chest up, the product held beside her face at cheek level.'

export const LIFESTYLE = {
  'hero-1': {
    aspect: '16:9',
    refs: ['serum-acido-hialuronico'],
    prompt: `An Argentine woman with long dark wavy hair and warm olive skin, bare shoulders, dewy radiant skin, holding the pale ice-blue dropper bottle from the reference ("nube skin / ácido hialurónico") beside her cheek with a soft smile. Seamless backdrop in a soft powder blue fading to warm cream. ${HERO_FRAME}`,
  },
  'hero-2': {
    aspect: '16:9',
    refs: ['serum-vitamina-c-15'],
    prompt: `A woman with honey-brown hair in a sleek low bun, sun-kissed light-medium skin with an even, luminous tone, small gold earrings, holding the amber dropper bottle from the reference ("AUREA LAB / Vitamina C 15%") near her cheekbone, eyes to camera. Warm golden-hour light with a gentle sun glow. Seamless backdrop in warm apricot fading to soft peach. ${HERO_FRAME}`,
  },
  'hero-3': {
    aspect: '16:9',
    refs: ['crema-reparadora-barrera'],
    prompt: `An Afro-Latina woman with deep brown glowing skin and short natural curls, holding the open ivory jar from the reference ("Clara Botánica / Crema reparadora de barrera") near her face, a small swipe of cream on the fingertip of her other hand, joyful and serene. Seamless backdrop in warm sand fading to soft terracotta. ${HERO_FRAME}`,
  },
  acne: {
    aspect: '4:5',
    refs: ['exfoliante-bha-2'],
    prompt: `A woman with dark straight hair in a high ponytail, light-tan skin with a flawless clear, smooth, softly matte complexion, holding the slate-blue bottle from the reference ("Mar de Sal / EXFOLIANTE BHA 2%"). Seamless backdrop in misty blue-grey. ${PORTRAIT_FRAME}`,
  },
  manchas: {
    aspect: '4:5',
    refs: ['serum-acido-azelaico-10'],
    prompt: `A woman with light brown shoulder-length hair and fair skin with a perfectly even, luminous tone, holding the slim ivory airless bottle with the blush-pink collar from the reference ("Clara Botánica / Sérum ácido azelaico 10%"). Seamless backdrop in soft blush pink. ${PORTRAIT_FRAME}`,
  },
  deshidratacion: {
    aspect: '4:5',
    refs: ['tonico-hidratante'],
    prompt: `A woman of East Asian descent with long black hair and plump, dewy, glass-like skin, holding the frosted lilac bottle from the reference ("nube skin / tónico hidratante"). Seamless backdrop in pale lilac. ${PORTRAIT_FRAME}`,
  },
  sensibilidad: {
    aspect: '4:5',
    refs: ['tonico-calmante-centella'],
    prompt: `A woman with auburn hair and fair skin that looks calm, even and comfortable, with no redness, holding the green glass bottle from the reference ("VERDE RAÍZ / Tónico calmante de centella"). Seamless backdrop in soft sage green. ${PORTRAIT_FRAME}`,
  },
  lineas: {
    aspect: '4:5',
    refs: ['crema-con-peptidos'],
    prompt: `A woman in her late twenties with a dark blonde bob and smooth, firm, radiant skin, holding the open dusty rose jar from the reference ("VERDE RAÍZ / Crema con péptidos"), a touch of cream on her fingertip. Seamless backdrop in dusty rose. ${PORTRAIT_FRAME}`,
  },
  poros: {
    aspect: '4:5',
    refs: ['mascarilla-de-arcilla'],
    prompt: `A woman with curly brown hair and tan skin with a smooth, refined, poreless-looking complexion, holding the open terracotta-pink jar from the reference ("Mar de Sal / MASCARILLA DE ARCILLA"). Seamless backdrop in pale clay pink. ${PORTRAIT_FRAME}`,
  },
  manana: {
    aspect: '4:5',
    refs: ['fluido-protector-fps-50'],
    prompt: `Bright morning campaign: a woman with long dark hair and olive skin, fresh and glowing, dotting sunscreen on her cheekbone with one finger while holding the butter-yellow tube from the reference ("Mar de Sal / Fluido protector FPS 50") in her other hand. Seamless backdrop in sunny butter yellow with a crisp palm-leaf shadow and clean morning sunlight. ${PORTRAIT_FRAME}`,
  },
  noche: {
    aspect: '4:5',
    refs: ['retinol-03-escualano'],
    prompt: `Evening campaign: a woman with sleek black hair and warm brown glowing skin, calm and radiant, letting a drop fall from the dark amber dropper from the reference ("VERDE RAÍZ / Retinol 0.3% en escualano") onto her fingertips. Seamless backdrop in deep plum-mauve with a warm amber rim light and a soft candle glow. ${PORTRAIT_FRAME}`,
  },
  ficha: {
    aspect: '4:5',
    refs: ['serum-niacinamida-10-zinc'],
    prompt: `A woman with a brunette pixie cut and light skin with a clear, refined, luminous complexion, holding the frosted glass dropper bottle from the reference ("AUREA LAB / Niacinamida 10% + Zinc") toward the camera, a single drop of serum on the fingertip of her other hand. Seamless backdrop in warm stone greige. ${PORTRAIT_FRAME}`,
  },
  diagnostico: {
    aspect: '4:5',
    refs: ['gel-crema-ligero'],
    prompt: `A woman with wavy chestnut hair and medium skin, glowing and healthy, gently touching her cheek with her fingertips and smiling at the camera, holding the frosted mint-green jar from the reference ("nube skin / gel crema ligero") in her other hand. Seamless backdrop in pale mint. ${PORTRAIT_FRAME}`,
  },
}

export function lifestylePrompt(name) {
  return `${LIFESTYLE[name].prompt} ${CAMPAIGN_STYLE}`
}
