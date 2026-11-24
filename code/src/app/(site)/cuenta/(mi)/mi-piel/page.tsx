import { FaceScan } from '@/components/icons'
import { ButtonLink } from '@/components/ui/button'
import { AccountHeading, countWord, EmptyState } from '@/components/account/ui'
import { getSettings } from '@/server/settings'
import { requireCustomer } from '@/server/customers/web'

// CU-08, CU-09. Diagnoses are saved to the account from Phase 3; until then
// every account is in the empty state.
export default async function MySkinPage() {
  await requireCustomer('/cuenta/mi-piel')
  const s = await getSettings()
  return (
    <>
      <AccountHeading icon={<FaceScan size={28} />} title="Mi piel" />
      <EmptyState
        icon={<FaceScan size={34} />}
        actions={
          <ButtonLink href="/diagnostico" size="lg">
            <FaceScan size={20} /> Hacer mi diagnóstico
          </ButtonLink>
        }
      >
        <p>Todavía no hiciste el diagnóstico. Son {countWord(s['copy.diagnosisQuestions'])} preguntas.</p>
      </EmptyState>
    </>
  )
}
