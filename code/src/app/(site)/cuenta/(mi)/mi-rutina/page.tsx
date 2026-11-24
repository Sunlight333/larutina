import { FaceScan, Layers } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { AccountHeading, EmptyState } from '@/components/account/ui'
import { requireCustomer } from '@/server/customers/web'

// CU-10, CU-11. Saved routines arrive with the diagnosis in Phase 3; until
// then every account is in the empty state.
export default async function MyRoutinePage() {
  await requireCustomer('/cuenta/mi-rutina')
  return (
    <>
      <AccountHeading icon={<Layers size={28} />} title="Mi rutina" />
      <EmptyState
        icon={<Layers size={34} />}
        actions={
          <>
            <ButtonLink href="/diagnostico" size="lg">
              <FaceScan size={20} /> Hacer mi diagnóstico
            </ButtonLink>
            <ButtonLink href="/rutinas" variant="secondary" size="lg">
              Ver rutinas
            </ButtonLink>
          </>
        }
      >
        <p>Todavía no guardaste una rutina. Hacé el diagnóstico o elegí una de nuestras rutinas armadas.</p>
      </EmptyState>
    </>
  )
}
