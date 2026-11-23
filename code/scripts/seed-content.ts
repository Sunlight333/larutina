// Loads the content file's first version of the site: the Home and the
// institutional and help pages (published), the journal categories, the five
// legal documents (drafts pending legal review) and the announcements.
// Creates only what is missing; running it again changes nothing.
//
//   npx tsx --env-file=.env scripts/seed-content.ts
import { PrismaClient } from '@prisma/client'
import { seedContent } from '../src/server/services/content/seed'

async function main() {
  const db = new PrismaClient()
  try {
    const report = await seedContent(db)
    const lines = Object.entries(report).map(([k, v]) => `${k}: ${v.length ? v.join(', ') : 'nada nuevo'}`)
    console.log(lines.join('\n'))
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
