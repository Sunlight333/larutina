import type { PrismaClient } from '@prisma/client'
import { saveUpload, UploadError } from '@/server/media'
import { bool, files, str } from './forms'

/**
 * Reads an <ImageField>: a new file is uploaded as public media and its key
 * returned; "Quitar" returns ""; otherwise the current key. Throws
 * UploadError with a message for the field.
 */
export async function readImageField(db: PrismaClient, form: FormData, name: string, actorEmail?: string): Promise<string> {
  if (bool(form, `${name}__remove`)) return ''
  const [file] = await files(form, `${name}__file`)
  if (file) return (await saveUpload(db, file, { visibility: 'PUBLIC', createdBy: actorEmail })).key
  return str(form, name)
}

export { UploadError }
