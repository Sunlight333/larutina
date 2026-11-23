// Imports a catalog workbook (template v1.1) from the command line.
//
//   npm run catalog:import -- <file.xlsx> [--dry-run] [--stage S5]
//
// --dry-run   validate and report; write nothing
// --stage S5  the full catalog: S5 columns become required (default S1)
//
// Uses DATABASE_URL. Exit code 1 when the file has errors.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { importCatalog } from '../src/server/catalog-import'

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--') && !/^S[15]$/.test(a))
  if (!file) {
    console.error('Usage: npm run catalog:import -- <file.xlsx> [--dry-run] [--stage S5]')
    process.exit(2)
  }
  const stage = args.includes('S5') ? 'S5' : 'S1'
  const db = new PrismaClient()
  try {
    const report = await importCatalog(db, { name: path.basename(file), data: readFileSync(file) }, { stage, dryRun: args.includes('--dry-run') })

    console.log(`\n${report.status}  ·  stage ${report.stage}  ·  ${report.errors} errors  ·  ${report.warnings} warnings  ·  job ${report.jobId}\n`)
    for (const [sheet, c] of Object.entries(report.counts)) {
      const parts = c.inFile !== undefined ? [`${c.inFile} in file`] : [`${c.created} created`, `${c.updated} updated`]
      console.log(`  ${sheet.padEnd(20)} ${parts.join(', ')}`)
    }
    const show = (level: string, title: string) => {
      const list = report.issues.filter((i) => i.level === level)
      if (!list.length) return
      console.log(`\n${title} (${list.length})`)
      for (const i of list) console.log(`  ${i.sheet}${i.row ? ` fila ${i.row}` : ''}${i.field ? ` · ${i.field}` : ''}: ${i.message}`)
    }
    show('error', 'Errores')
    show('warning', 'Advertencias')
    show('info', 'Notas')
    if (report.missing.length) {
      console.log('\nVacíos que el catálogo completo (S5) va a necesitar')
      for (const m of report.missing) console.log(`  ${m.sheet} · ${m.field}: ${m.rows} filas`)
    }
    if (report.errors) process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
