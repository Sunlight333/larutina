import { getDb } from '@/server/db'
import { exportWaitlist } from '@/server/services/content/subscribers'
import { csvResponse, exportAdmin } from '../csv-response'

// GEN-08: the waitlist as CSV; ?solo-nuevos=1 brings only rows not exported before.
export async function GET(req: Request) {
  const admin = await exportAdmin()
  if (admin instanceof Response) return admin
  const onlyNew = new URL(req.url).searchParams.get('solo-nuevos') === '1'
  const { csv } = await exportWaitlist(getDb(), admin, { onlyNew })
  return csvResponse(csv, onlyNew ? 'lista-de-espera-nuevos' : 'lista-de-espera')
}
