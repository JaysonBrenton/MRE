/**
 * @fileoverview In-process runtime cache for effective ingestion settings (Next.js)
 */

import { prisma } from "@/lib/prisma"
import { getSettingDefinition } from "@/core/admin/ingestion-settings-registry"
import {
  parseEnvValue,
  parseStoredValue,
  type SettingValue,
} from "@/core/admin/ingestion-settings-value"

const dbOverrides = new Map<string, string>()
let loadedAt = 0

export function isRuntimeCacheWarm(): boolean {
  return loadedAt > 0
}

function cacheTtlMs(): number {
  const raw = process.env.INGESTION_SETTINGS_CACHE_TTL_SECONDS ?? "30"
  const seconds = Number.parseInt(raw, 10)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 30_000
}

export function invalidateRuntimeSettingsCache(): void {
  dbOverrides.clear()
  loadedAt = 0
}

export async function refreshRuntimeSettingsCache(force = false): Promise<void> {
  const ttl = cacheTtlMs()
  if (!force && dbOverrides.size > 0 && ttl > 0 && Date.now() - loadedAt < ttl) {
    return
  }
  const rows = await prisma.ingestionSetting.findMany({
    select: { key: true, value: true },
  })
  dbOverrides.clear()
  for (const row of rows) {
    dbOverrides.set(row.key, row.value)
  }
  loadedAt = Date.now()
}

export function getRuntimeEffectiveValue(key: string): SettingValue | undefined {
  const definition = getSettingDefinition(key)
  if (!definition) {
    return undefined
  }

  const rawDb = dbOverrides.get(key)
  if (rawDb !== undefined) {
    return parseStoredValue(definition, rawDb)
  }

  const rawEnv = process.env[key]
  if (rawEnv !== undefined) {
    return parseEnvValue(definition, rawEnv)
  }

  return definition.default as SettingValue
}

export async function getRuntimeBoolean(key: string, fallback = true): Promise<boolean> {
  await refreshRuntimeSettingsCache()
  const value = getRuntimeEffectiveValue(key)
  if (value === undefined) return fallback
  return Boolean(value)
}
