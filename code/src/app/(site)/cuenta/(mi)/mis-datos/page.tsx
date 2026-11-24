import { IconBadge, Lock, Mail, MapPin, Trash, User } from '@/components/icons'
import { AccountHeading } from '@/components/account/ui'
import { AddressBook, DeleteAccount, NewsletterSwitch, PasswordForm, ProfileForm, type AddressData, type ProfileData } from '@/components/account/my-data-forms'
import { getDb } from '@/server/db'
import { requireCustomer } from '@/server/customers/web'

// CU-16: Datos personales · Direcciones · Contraseña · Comunicaciones ·
// Eliminar mi cuenta (CU-17). No cards are stored.
export default async function MyDataPage() {
  const session = await requireCustomer('/cuenta/mis-datos')
  const db = getDb()
  const [c, rows] = await Promise.all([
    db.customer.findUniqueOrThrow({ where: { id: session.id } }),
    db.address.findMany({ where: { customerId: session.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
  ])
  const profile: ProfileData = { email: c.email, firstName: c.firstName ?? '', lastName: c.lastName ?? '', dni: c.dni ?? '', phone: c.phone ?? '' }
  const addresses: AddressData[] = rows.map((a) => ({ id: a.id, firstName: a.firstName, lastName: a.lastName, dni: a.dni, phone: a.phone, street: a.street, unit: a.unit ?? '', postcode: a.postcode, locality: a.locality, province: a.province, notes: a.notes ?? '', isDefault: a.isDefault }))

  return (
    <>
      <AccountHeading icon={<User size={28} />} title="Mis datos" />
      <div className="space-y-5">
        <Section id="datos" title="Datos personales" icon={<User size={22} />} shape="rounded-[1.5rem_3rem_1.5rem_3rem]">
          <ProfileForm initial={profile} />
        </Section>
        <Section id="direcciones" title="Direcciones" icon={<MapPin size={22} />} shape="rounded-[3rem_1.5rem_3rem_1.5rem]">
          <AddressBook addresses={addresses} profile={profile} />
        </Section>
        <Section id="contrasena" title="Contraseña" icon={<Lock size={22} />} shape="rounded-[1.5rem_3rem_1.5rem_3rem]">
          <PasswordForm />
        </Section>
        <Section id="comunicaciones" title="Comunicaciones" icon={<Mail size={22} />} shape="rounded-[3rem_1.5rem_3rem_1.5rem]">
          <NewsletterSwitch on={c.newsletter} />
        </Section>
        <Section id="eliminar" title="Eliminar mi cuenta" icon={<Trash size={22} />} shape="rounded-[1.5rem_3rem_1.5rem_3rem]">
          <DeleteAccount />
        </Section>
      </div>
    </>
  )
}

function Section({ id, title, icon, shape, children }: { id: string; title: string; icon: React.ReactNode; shape: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`scroll-mt-28 bg-paper p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-8 ${shape}`}>
      <h2 id={id} className="mb-6 flex items-center gap-3 font-display text-display-sm">
        <IconBadge size="sm">{icon}</IconBadge>
        {title}
      </h2>
      {children}
    </section>
  )
}
