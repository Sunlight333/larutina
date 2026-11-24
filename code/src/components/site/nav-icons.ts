import { Award, Bulb, Chat, Droplet, FaceScan, Layers, Serum, Sparkle } from '@/components/icons'

// Each menu link carries an icon chosen from its address, so links added in
// the panel get one too.
const NAV_ICONS: [RegExp, typeof Serum][] = [
  [/^\/(productos|categoria|rutinas)/, Serum],
  [/^\/(necesidades|necesidad|piel)/, Droplet],
  [/^\/marca/, Award],
  [/^\/journal/, Bulb],
  [/^\/diagnostico/, FaceScan],
  [/^\/nosotras/, Sparkle],
  [/^\/(contacto|preguntas)/, Chat],
]

export function navIcon(href: string) {
  return NAV_ICONS.find(([re]) => re.test(href))?.[1] ?? Layers
}
