'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { AdminRole } from '@prisma/client'
import { getDb } from '@/server/db'
import { audit } from '@/server/audit'
import { hashPassword } from '@/server/auth/password'
import { requireAdmin } from '@/server/auth/session'
import { ROLE_LABELS } from '@/server/auth/permissions'
import { bool, fail, fromZod, ok, str, type FormState } from '@/server/admin/forms'

const roles = Object.keys(ROLE_LABELS) as [AdminRole, ...AdminRole[]]
const tempPassword = () => randomBytes(12).toString('base64url')

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email('El email no es válido.'),
  name: z.string().trim().min(2, 'Escribí el nombre.'),
  role: z.enum(roles, { message: 'Elegí un rol.' }),
})

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('users.manage')
  const parsed = userSchema.safeParse({ email: str(form, 'email'), name: str(form, 'name'), role: str(form, 'role') })
  if (!parsed.success) return fromZod(parsed.error)
  const db = getDb()
  if (await db.adminUser.findUnique({ where: { email: parsed.data.email } })) return fail('Ya hay un usuario con ese email.', { email: 'Ya existe.' })
  const password = tempPassword()
  const user = await db.adminUser.create({ data: { ...parsed.data, passwordHash: await hashPassword(password) } })
  await audit(db, admin, { action: 'user.create', entityType: 'AdminUser', entityId: user.id, label: user.email, after: parsed.data })
  revalidatePath('/admin/usuarios')
  return ok(`Usuario creado. Contraseña temporal: ${password} — compartila por un canal seguro. Al ingresar activa la verificación en dos pasos, y conviene que cambie la contraseña en "Mi cuenta".`)
}

export async function updateUser(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin('users.manage')
  const db = getDb()
  const user = await db.adminUser.findUniqueOrThrow({ where: { id } })
  const parsed = userSchema.omit({ email: true }).safeParse({ name: str(form, 'name'), role: str(form, 'role') })
  if (!parsed.success) return fromZod(parsed.error)
  const active = bool(form, 'active')
  if (user.id === admin.id && (!active || parsed.data.role !== 'ADMIN')) return fail('No podés desactivarte ni quitarte el rol Administración a vos misma.')
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: { ...parsed.data, active } })
    if (!active) await tx.adminSession.deleteMany({ where: { userId: id } })
    await audit(tx, admin, { action: 'user.update', entityType: 'AdminUser', entityId: id, label: user.email, before: { name: user.name, role: user.role, active: user.active }, after: { ...parsed.data, active } })
  })
  revalidatePath('/admin/usuarios')
  return ok('Usuario actualizado.')
}

export async function resetPassword(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('users.manage')
  const db = getDb()
  const password = tempPassword()
  const user = await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } })
  await db.adminSession.deleteMany({ where: { userId: id } })
  await audit(db, admin, { action: 'user.reset-password', entityType: 'AdminUser', entityId: id, label: user.email })
  return ok(`Contraseña temporal nueva: ${password}`)
}

export async function resetTwoFactor(id: string, _prev: FormState): Promise<FormState> {
  const admin = await requireAdmin('users.manage')
  const db = getDb()
  const user = await db.adminUser.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } })
  await db.adminSession.deleteMany({ where: { userId: id } })
  await audit(db, admin, { action: 'user.reset-2fa', entityType: 'AdminUser', entityId: id, label: user.email })
  return ok('Verificación en dos pasos reiniciada: la configura de nuevo al ingresar.')
}

export async function goToUser(form: FormData) {
  redirect(`/usuarios/${String(form.get('id'))}`)
}
