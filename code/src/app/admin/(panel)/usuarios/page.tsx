import Link from 'next/link'
import { getDb } from '@/server/db'
import { requireAdmin } from '@/server/auth/session'
import { ROLE_LABELS } from '@/server/auth/permissions'
import { AdminForm } from '@/components/admin/form'
import { Select, TextField } from '@/components/admin/fields'
import { DataTable } from '@/components/admin/table'
import { Badge, Card, PageHeader, formatDateTime } from '@/components/admin/ui'
import { createUser } from './actions'

export const metadata = { title: 'Usuarios' }

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

export default async function UsersPage() {
  await requireAdmin('users.manage')
  const users = await getDb().adminUser.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  return (
    <>
      <PageHeader title="Usuarios del panel" description="Cada rol ve solo lo que necesita. Todos usan verificación en dos pasos." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <DataTable
          rows={users}
          rowKey={(u) => u.id}
          columns={[
            { key: 'name', label: 'Nombre', render: (u) => <Link className="font-medium underline-offset-2 hover:underline" href={`/usuarios/${u.id}`}>{u.name}</Link> },
            { key: 'email', label: 'Email', render: (u) => u.email },
            { key: 'role', label: 'Rol', render: (u) => ROLE_LABELS[u.role] },
            { key: 'state', label: 'Estado', render: (u) => (!u.active ? <Badge tone="danger">Inactivo</Badge> : u.totpEnabledAt ? <Badge tone="success">Activo</Badge> : <Badge tone="warning">Sin 2FA todavía</Badge>) },
            { key: 'last', label: 'Último ingreso', render: (u) => formatDateTime(u.lastLoginAt) },
          ]}
        />
        <Card title="Nuevo usuario">
          <AdminForm action={createUser} submitLabel="Crear usuario" resetOnSuccess>
            <TextField name="name" label="Nombre" required />
            <TextField name="email" label="Email" type="email" required />
            <Select name="role" label="Rol" options={roleOptions} defaultValue="CATALOG" />
          </AdminForm>
        </Card>
      </div>
    </>
  )
}
