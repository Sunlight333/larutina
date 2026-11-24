import type { SiteMode } from '@/server/site-access'
import { adminHref } from '@/lib/hosts'

export function TeamBar({ mode, isAdmin }: { mode: SiteMode; isAdmin: boolean }) {
  const text =
    mode === 'maintenance'
      ? 'Vista del equipo: el sitio está en mantenimiento y las visitas no lo ven.'
      : 'Vista del equipo: las visitas ven la ventana "Próximamente" al entrar; vos no.'
  return (
    <div className="bg-night-deep px-4 py-2 text-center text-[0.8125rem] text-paper">
      {text}{' '}
      {isAdmin ? (
        <a href={adminHref()}className="underline underline-offset-2">
          Ir al panel
        </a>
      ) : (
        <a href="/vista-previa?salir=1" className="underline underline-offset-2">
          Salir de la vista previa
        </a>
      )}
    </div>
  )
}
