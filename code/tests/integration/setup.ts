// Starts a PostgreSQL for the integration tests on its own port, with a fresh
// database and every migration applied. The cluster lives in the system temp
// folder and is reused between runs; only the database is recreated.
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import type { TestProject } from 'vitest/node'
import { devPostgres } from '../../scripts/dev-db'

const PORT = 54330
const DATABASE = 'larutina_test'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const pg = devPostgres(path.join(os.tmpdir(), 'larutina-test-pg'), PORT, true)
  await pg.start('postgres')
  const client = await pg.client('postgres')
  await client.query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`)
  await client.query(`CREATE DATABASE "${DATABASE}"`)
  await client.end()

  const url = pg.url(DATABASE)
  const prisma = path.join(project.config.root, 'node_modules', 'prisma', 'build', 'index.js')
  execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'ignore' })
  project.provide('databaseUrl', url)

  return async () => {
    await pg.stop()
  }
}
