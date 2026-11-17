'use server'

import { redirect } from 'next/navigation'
import { createDiagnosis } from '@/server/services/diagnosis'

/**
 * Saves the whole diagnosis (answers + result) in one transaction and sends
 * the person to their result. Input is validated in the service; the client
 * never sends anything but raw answers.
 */
export async function submitDiagnosis(answers: unknown): Promise<{ error: string } | void> {
  let id: string
  try {
    id = await createDiagnosis(answers)
  } catch (error) {
    console.error('submitDiagnosis failed', error)
    return { error: 'No pudimos guardar tu diagnóstico. Probá de nuevo en unos segundos.' }
  }
  redirect(`/diagnostico/resultado/${id}`)
}
