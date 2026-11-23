'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/server/db'
import { audit, changedFields } from '@/server/audit'
import { requireAdmin } from '@/server/auth/session'
import { can } from '@/server/auth/permissions'
import { loadSettings, saveSettings, SETTINGS, type SettingKey } from '@/server/settings'
import type { SettingGroup } from '@/server/settings/registry'
import { bool, fail, lines, moneyCents, ok, str, type FormState } from '@/server/admin/forms'
import { readImageField, UploadError } from '@/server/admin/media-field'
import { rotatePreviewToken } from '@/server/site-access'
import { groupPermission } from './groups'

export async function saveSettingsGroup(group: SettingGroup, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin(groupPermission(group))
  const db = getDb()
  const defs = SETTINGS.filter((d) => d.group === group && (!d.adminOnly || admin.role === 'ADMIN'))
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}

  for (const d of defs) {
    switch (d.type) {
      case 'boolean':
        values[d.key] = bool(form, d.key)
        break
      case 'number': {
        const v = str(form, d.key)
        const n = Number(v.replace(',', '.'))
        if (v === '' || !Number.isFinite(n) || n < 0) errors[d.key] = 'Tiene que ser un número.'
        else values[d.key] = n
        break
      }
      case 'money': {
        const c = moneyCents(form, d.key)
        if (c !== null && Number.isNaN(c)) errors[d.key] = 'Escribí el monto sin puntos ni símbolo, por ejemplo 50000.'
        else values[d.key] = c ?? 0
        break
      }
      case 'codes':
        values[d.key] = lines(form, d.key)
        break
      case 'links': {
        try {
          const parsed = JSON.parse(str(form, d.key) || '[]') as { label: string; href: string; highlight?: boolean }[]
          values[d.key] = parsed.map((l) => ({ label: String(l.label).trim(), href: String(l.href).trim(), ...(l.highlight ? { highlight: true } : {}) }))
        } catch {
          errors[d.key] = 'La lista no es válida.'
        }
        break
      }
      case 'image':
        try {
          values[d.key] = await readImageField(db, form, d.key, admin.email)
        } catch (e) {
          if (e instanceof UploadError) errors[d.key] = e.message
          else throw e
        }
        break
      case 'url': {
        const v = str(form, d.key)
        if (v && !/^https?:\/\//.test(v)) errors[d.key] = 'El link tiene que empezar con https://'
        else values[d.key] = v
        break
      }
      case 'email': {
        const v = str(form, d.key).toLowerCase()
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[d.key] = 'El email no es válido.'
        else values[d.key] = v
        break
      }
      default:
        values[d.key] = str(form, d.key)
    }
  }
  if (Object.keys(errors).length) return fail('Revisá los campos marcados.', errors)

  const before = (await loadSettings(db)) as Record<string, unknown>
  const diff = changedFields(before, values)
  if (!diff.changed) return ok('No había cambios.')
  await db.$transaction(async (tx) => {
    await saveSettings(tx, diff.after as Partial<Record<SettingKey, unknown>>, admin.email)
    await audit(tx, admin, { action: 'settings.update', entityType: 'Setting', label: group, before: diff.before, after: diff.after })
  })
  revalidatePath('/', 'layout')
  return ok('Configuración guardada.')
}

export async function rotatePreview(_prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('settings.brand')
  if (!can(admin.role, 'settings.brand')) return fail('Sin permiso.')
  await rotatePreviewToken(getDb())
  await audit(getDb(), admin, { action: 'preview.rotate', entityType: 'Setting', label: 'Link de vista previa' })
  revalidatePath('/admin/configuracion')
  return ok('Link nuevo creado. Los anteriores dejaron de funcionar.')
}
