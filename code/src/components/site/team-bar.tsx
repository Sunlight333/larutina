import type { SiteMode } from '@/server/site-access'

export function TeamBar({ mode, isAdmin }: { mode: SiteMode; isAdmin: boolean }) {
  const label = mode === 'maintenance' ? 'mantenimiento' : 'Próximamente'
  return (
    <div className="bg-night-deep px-4 py-2 text-center text-[0.8125rem] text-paper">
      Vista del equipo: el sitio está en modo {label} y las visitas no lo ven.{' '}
      {isAdmin ? (
        <a href="/admin" className="underline underline-offset-2">
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
