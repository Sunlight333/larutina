import { getDb } from '@/server/db'
import { exportNewsletter } from '@/server/services/content/subscribers'
import { csvResponse, exportAdmin } from '../csv-response'

// G-17: active newsletter subscribers as CSV.
export async function GET() {
  const admin = await exportAdmin()
  if (admin instanceof Response) return admin
  const { csv } = await exportNewsletter(getDb(), admin)
  return csvResponse(csv, 'newsletter')
}
