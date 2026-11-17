'use client'

import { LinkIcon } from './icons'
import { buttonClasses } from './ui/button'
import { useToast } from './toast'

export function CopyLinkButton() {
  const { show } = useToast()

  async function copy() {
    const url = window.location.href
    try {
      // The share sheet is the natural gesture on phones, including in-app browsers.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Mi rutina', url })
        return
      }
      await navigator.clipboard.writeText(url)
      show('Link copiado. Abrilo en cualquier dispositivo y vas a ver la misma rutina.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') show('No pudimos copiar el link. Copialo desde la barra de direcciones.')
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses('secondary', 'md')}>
      <LinkIcon size={18} />
      Compartir mi rutina
    </button>
  )
}
