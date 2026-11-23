// Local PostgreSQL 17 for development and tests, with no Docker or system
// install: the embedded-postgres package ships the server binaries.
//
//   npm run db:dev    start it (data in .pgdata/data, port 54329) and keep it running;
//                     Ctrl+C stops it
//
// DATABASE_URL for it: postgresql://postgres:postgres@localhost:54329/larutina
//
// On Windows the server is started with pg_ctl, which drops administrator
// rights itself: PostgreSQL refuses to run as an administrator, and this
// machine's account is one. The server's processes need the console that
// started them, so this script stays running for as long as the server does.
import EmbeddedPostgres from 'embedded-postgres'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

export const DEV_PORT = 54329
export const devUrl = (port = DEV_PORT, database = 'larutina') => `postgresql://postgres:postgres@localhost:${port}/${database}`

function pgCtl(): string | null {
  if (process.platform !== 'win32') return null
  // The package only exports dist/index.js; the binaries sit next to dist/.
  const entry = createRequire(import.meta.url).resolve('@embedded-postgres/windows-x64')
  return path.join(path.dirname(entry), '..', 'native', 'bin', 'pg_ctl.exe')
}

export function devPostgres(root = path.resolve(import.meta.dirname, '../.pgdata'), port = DEV_PORT, quiet = false) {
  // Data and log side by side: a log inside the data folder is locked by
  // pg_ctl while crash recovery tries to sync it, a Windows-only failure.
  const dir = path.join(root, 'data')
  const log = path.join(root, 'server.log')
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: quiet ? () => {} : (m) => process.stdout.write(String(m)),
    onError: (e) => console.error(String(e)),
  })
  const ctl = pgCtl()
  // The server writes to its log file; inheriting this process's output would
  // keep a caller's pipe open for as long as the server runs.
  const run = (args: string[]) => execFileSync(ctl!, args, { stdio: 'ignore' })

  return {
    url: (database = 'larutina') => devUrl(port, database),
    /** A connected client on the given database; the caller ends it. */
    async client(database = 'postgres') {
      const client = pg.getPgClient(database)
      await client.connect()
      return client
    },
    async start(database = 'larutina') {
      if (!existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise()
      if (ctl) {
        const running = (() => {
          try {
            execFileSync(ctl, ['status', '-D', dir], { stdio: 'ignore' })
            return true
          } catch {
            return false
          }
        })()
        if (!running) run(['start', '-w', '-D', dir, '-l', log, '-o', `-p ${port}`])
      } else {
        await pg.start()
      }
      const client = pg.getPgClient()
      await client.connect()
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
      if (!rowCount) await client.query(`CREATE DATABASE "${database}"`)
      await client.end()
    },
    async stop() {
      if (ctl) run(['stop', '-w', '-m', 'fast', '-D', dir])
      else await pg.stop()
    },
  }
}

async function main() {
  const db = devPostgres()
  await db.start()
  console.log(`PostgreSQL ready: ${db.url()}\nCtrl+C to stop.`)
  const shutdown = async () => {
    await db.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  setInterval(() => {}, 1 << 30)
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/dev-db.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
