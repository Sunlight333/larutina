/** wa.me link for an Argentine number as written in the panel, with an optional prefilled text (G-09). */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
