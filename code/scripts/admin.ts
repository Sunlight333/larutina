// Panel users from the command line, for the first admin and for lockouts.
// Locally: npm run admin -- <command>. On the server: larutina-admin <command>.
//
//   create <email> "<name>" [ROLE]   ROLE: ADMIN (default), CATALOG, CONTENT, SUPPORT, AMBASSADORS
//   reset-password <email>           prints a new temporary password
//   reset-2fa <email>                the user enrols again at the next sign-in
//   list
import { randomBytes } from 'node:crypto'
import { PrismaClient, type AdminRole } from '@prisma/client'
import { hashPassword } from '../src/server/auth/password'

const ROLES = ['ADMIN', 'CATALOG', 'CONTENT', 'SUPPORT', 'AMBASSADORS'] as const

async function main() {
  const [command, email, ...rest] = process.argv.slice(2)
  const db = new PrismaClient()
  const temp = () => randomBytes(12).toString('base64url')
  try {
    switch (command) {
      case 'create': {
        const [name, role = 'ADMIN'] = rest
        if (!email || !name || !ROLES.includes(role as AdminRole)) throw new Error('Usage: create <email> "<name>" [ROLE]')
        const password = temp()
        const user = await db.adminUser.create({ data: { email: email.toLowerCase(), name, role: role as AdminRole, passwordHash: await hashPassword(password) } })
        await db.auditLog.create({ data: { action: 'user.create', entityType: 'AdminUser', entityId: user.id, label: user.email, actorEmail: 'cli' } })
        console.log(`Created ${user.email} (${user.role}). Temporary password: ${password}`)
        console.log('Two-factor setup is asked at the first sign-in, at /admin/login.')
        break
      }
      case 'reset-password': {
        if (!email) throw new Error('Usage: reset-password <email>')
        const password = temp()
        const user = await db.adminUser.update({ where: { email: email.toLowerCase() }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } })
        await db.adminSession.deleteMany({ where: { userId: user.id } })
        await db.auditLog.create({ data: { action: 'user.reset-password', entityType: 'AdminUser', entityId: user.id, label: user.email, actorEmail: 'cli' } })
        console.log(`New temporary password for ${user.email}: ${password}`)
        break
      }
      case 'reset-2fa': {
        if (!email) throw new Error('Usage: reset-2fa <email>')
        const user = await db.adminUser.update({ where: { email: email.toLowerCase() }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } })
        await db.adminSession.deleteMany({ where: { userId: user.id } })
        await db.auditLog.create({ data: { action: 'user.reset-2fa', entityType: 'AdminUser', entityId: user.id, label: user.email, actorEmail: 'cli' } })
        console.log(`Two-factor reset for ${user.email}.`)
        break
      }
      case 'list': {
        for (const u of await db.adminUser.findMany({ orderBy: { email: 'asc' } })) {
          console.log(`${u.email}\t${u.role}\t${u.active ? 'active' : 'inactive'}\t2FA ${u.totpEnabledAt ? 'on' : 'pending'}`)
        }
        break
      }
      default:
        console.log('Commands: create <email> "<name>" [ROLE] | reset-password <email> | reset-2fa <email> | list')
        process.exitCode = command ? 2 : 0
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
