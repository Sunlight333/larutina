import type { PrismaClient } from '@prisma/client'
import { readImageField, UploadError } from '@/server/admin/media-field'
import { readBlocksForm, type PageDoc } from './blocks'
import type { ImageReader } from './fields'

// Reading panel forms that carry images. The form is first read and checked
// without uploading anything; only a valid form uploads its new files, so a
// typo elsewhere never leaves orphan images in the library.

const PENDING_UPLOAD = '__nueva-imagen__'

export function imageReaders(db: PrismaClient, form: FormData, actorEmail?: string): { dry: ImageReader; real: ImageReader } {
  const str = (name: string) => {
    const v = form.get(name)
    return typeof v === 'string' ? v.trim() : ''
  }
  return {
    dry: async (name) => {
      if (form.get(`${name}__remove`) === 'on') return ''
      const hasFile = form.getAll(`${name}__file`).some((f) => typeof f !== 'string' && f.size > 0)
      return hasFile ? PENDING_UPLOAD : str(name)
    },
    real: async (name) => {
      try {
        return await readImageField(db, form, name, actorEmail)
      } catch (e) {
        if (e instanceof UploadError) return { error: e.message }
        throw e
      }
    },
  }
}

export type PageFormResult = { doc: PageDoc; errors: Record<string, string>; message?: string }

const limits = { title: 160, seoTitle: 70, seoDescription: 155 }

/** The page editor form: title, SEO fields and blocks. */
export async function readPageForm(db: PrismaClient, form: FormData, actorEmail?: string): Promise<PageFormResult> {
  const text = (name: string) => {
    const v = form.get(name)
    return typeof v === 'string' ? v.trim() : ''
  }
  const head = { title: text('title'), seoTitle: text('seoTitle'), seoDescription: text('seoDescription') }
  const headErrors: Record<string, string> = {}
  if (!head.title) headErrors.title = 'Escribí el título.'
  for (const [k, max] of Object.entries(limits) as [keyof typeof limits, number][]) {
    if (head[k].length > max) headErrors[k] = `Hasta ${max} caracteres (tiene ${head[k].length}).`
  }

  const readers = imageReaders(db, form, actorEmail)
  const check = await readBlocksForm(form, readers.dry)
  const errors = { ...headErrors, ...check.errors }
  if (Object.keys(errors).length) return { doc: { ...head, blocks: check.blocks }, errors, message: summary(check.invalid) }

  const final = await readBlocksForm(form, readers.real)
  return { doc: { ...head, blocks: final.blocks }, errors: final.errors, message: Object.keys(final.errors).length ? summary(final.invalid) : undefined }
}

function summary(invalid: string[]) {
  return invalid.length ? `Revisá los campos marcados en: ${invalid.join(', ')}.` : 'Revisá los campos marcados.'
}
