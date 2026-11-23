import { cache } from 'react'
import type { Prisma, PrismaClient } from '@prisma/client'
import { getDb } from '@/server/db'
import { defaultSettings, settingDef, type SettingKey, type SettingValues } from './registry'

export { SETTINGS, SETTING_GROUPS, settingDef, type SettingKey, type SettingValues, type LinkItem } from './registry'

/** All settings: stored values over the registry defaults. */
export async function loadSettings(db: PrismaClient): Promise<SettingValues> {
  const values = defaultSettings() as Record<string, unknown>
  for (const row of await db.setting.findMany()) {
    if (settingDef(row.key)) values[row.key] = row.value
  }
  return values as SettingValues
}

/** Per request. Without a database (unit tests, a bare build) the defaults. */
export const getSettings = cache(async () => (process.env.DATABASE_URL ? loadSettings(getDb()) : defaultSettings()))

export async function saveSettings(db: PrismaClient | Prisma.TransactionClient, values: Partial<Record<SettingKey, unknown>>, actorEmail?: string) {
  for (const [key, value] of Object.entries(values)) {
    if (!settingDef(key)) throw new Error(`Unknown setting ${key}`)
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: actorEmail },
      update: { value: value as Prisma.InputJsonValue, updatedBy: actorEmail },
    })
  }
}
