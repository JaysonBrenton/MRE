/**
 * @fileoverview Admin ingestion settings — resolve, read, write, and reload
 */

import { env } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/core/admin/audit"
import {
  INGESTION_SETTING_CATEGORY_LABELS,
  INGESTION_SETTING_CATEGORY_ORDER,
  getSettingDefinition,
  listAdminVisibleSettings,
  listSettingKeys,
  type IngestionSettingApplyMode,
  type IngestionSettingCategory,
  type IngestionSettingDefinition,
  type IngestionSettingType,
} from "@/core/admin/ingestion-settings-registry"
import {
  invalidateRuntimeSettingsCache,
  refreshRuntimeSettingsCache,
} from "@/core/admin/ingestion-settings-runtime"
import {
  assertConfirmations,
  validateSettingUpdate,
  type PatchBody,
} from "@/core/admin/ingestion-settings-validation"
import {
  maskSecretValue,
  parseEnvValue,
  parseStoredValue,
  serializeSettingValue,
  type SettingValue,
} from "@/core/admin/ingestion-settings-value"

export type IngestionSettingSource = "database" | "environment" | "default"

export interface AdminIngestionSetting {
  key: string
  label: string
  description: string
  category: IngestionSettingCategory
  type: IngestionSettingType
  applyMode: IngestionSettingApplyMode
  scope: IngestionSettingDefinition["scope"]
  writable: boolean
  effectiveValue: SettingValue
  source: IngestionSettingSource
  envValue: SettingValue | null
  dbValue: SettingValue | null
  defaultValue: SettingValue
  pendingRestart: boolean
  min?: number
  max?: number
  enumValues?: string[]
  confirmWhen?: IngestionSettingDefinition["confirmWhen"]
  dockerService?: IngestionSettingDefinition["dockerService"]
}

export interface AdminIngestionSettingsCategory {
  id: IngestionSettingCategory
  label: string
}

export interface AdminIngestionSettingsResponse {
  settings: AdminIngestionSetting[]
  categories: AdminIngestionSettingsCategory[]
  writable: boolean
}

function buildCategories(settings: AdminIngestionSetting[]): AdminIngestionSettingsCategory[] {
  const present = new Set(settings.map((setting) => setting.category))
  return INGESTION_SETTING_CATEGORY_ORDER.filter((category) => present.has(category)).map(
    (category) => ({
      id: category,
      label: INGESTION_SETTING_CATEGORY_LABELS[category],
    })
  )
}

function orderSettings(settings: AdminIngestionSetting[]): AdminIngestionSetting[] {
  const order = new Map(listSettingKeys().map((key, index) => [key, index]))
  return [...settings].sort(
    (a, b) =>
      (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER)
  )
}

function resolveSetting(
  definition: IngestionSettingDefinition,
  dbOverrides: Map<string, string>
): AdminIngestionSetting {
  const defaultValue = definition.default as SettingValue
  let source: IngestionSettingSource = "default"
  let effectiveValue: SettingValue = defaultValue
  let envValue: SettingValue | null = null
  let dbValue: SettingValue | null = null

  const rawEnv = process.env[definition.key]
  if (rawEnv !== undefined) {
    envValue = parseEnvValue(definition, rawEnv)
  }
  const rawDb = dbOverrides.get(definition.key)
  if (rawDb !== undefined) {
    dbValue = parseStoredValue(definition, rawDb)
    effectiveValue = dbValue
    source = "database"
  } else if (envValue !== null) {
    effectiveValue = envValue
    source = "environment"
  }

  const mask = (value: SettingValue | null) =>
    value === null ? null : maskSecretValue(definition.key, value, definition.secret)

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    category: definition.category,
    type: definition.type,
    applyMode: definition.applyMode,
    scope: definition.scope,
    writable: definition.writable,
    effectiveValue: mask(effectiveValue) as SettingValue,
    source,
    envValue: mask(envValue),
    dbValue: mask(dbValue),
    defaultValue,
    pendingRestart: false,
    ...(definition.min !== undefined ? { min: definition.min } : {}),
    ...(definition.max !== undefined ? { max: definition.max } : {}),
    ...(definition.enumValues ? { enumValues: [...definition.enumValues] } : {}),
    ...(definition.confirmWhen ? { confirmWhen: definition.confirmWhen } : {}),
    ...(definition.dockerService ? { dockerService: definition.dockerService } : {}),
  }
}

export async function listAdminIngestionSettings(): Promise<AdminIngestionSettingsResponse> {
  await refreshRuntimeSettingsCache(true)
  const rows = await prisma.ingestionSetting.findMany({ select: { key: true, value: true } })
  const dbOverrides = new Map(rows.map((row) => [row.key, row.value]))

  const settings = orderSettings(
    listAdminVisibleSettings().map((definition) => resolveSetting(definition, dbOverrides))
  )

  return {
    settings,
    categories: buildCategories(settings),
    writable: process.env.ADMIN_INGESTION_SETTINGS_WRITABLE === "true",
  }
}

/** @deprecated Use listAdminIngestionSettings */
export async function fetchAdminIngestionSettings(): Promise<AdminIngestionSettingsResponse> {
  return listAdminIngestionSettings()
}

export async function reloadIngestionSettingsCaches(): Promise<void> {
  invalidateRuntimeSettingsCache()
  await refreshRuntimeSettingsCache(true)

  const token = process.env.INGESTION_ADMIN_TOKEN
  const ingestionServiceUrl = env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"
  if (!token) return

  await fetch(`${ingestionServiceUrl}/api/v1/admin/settings/reload`, {
    method: "POST",
    headers: { "X-Ingestion-Admin-Token": token },
    cache: "no-store",
  })
}

export async function patchAdminIngestionSettings(
  body: PatchBody,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ updated: string[]; settings: AdminIngestionSettingsResponse }> {
  const validated = body.updates.map((update) => {
    const result = validateSettingUpdate(update.key, update.value)
    return { ...result, requested: update.value }
  })

  assertConfirmations(
    validated.map(({ definition, parsed }) => ({ definition, parsed })),
    body.confirmToken
  )

  const updatedKeys: string[] = []

  for (const { definition, serialized, parsed } of validated) {
    const defaultSerialized = serializeSettingValue(definition, definition.default as SettingValue)
    const existing = await prisma.ingestionSetting.findUnique({ where: { key: definition.key } })
    const oldEffective = existing?.value ?? null

    if (serialized === defaultSerialized) {
      if (existing) {
        await prisma.ingestionSetting.delete({ where: { key: definition.key } })
        updatedKeys.push(definition.key)
        await createAuditLog({
          userId: adminUserId,
          action: "ingestion.settings.reset",
          resourceType: "ingestion_setting",
          resourceId: definition.key,
          details: { oldValue: oldEffective, newValue: null },
          ipAddress,
          userAgent,
        })
      }
      continue
    }

    await prisma.ingestionSetting.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        value: serialized,
        updatedBy: adminUserId,
      },
      update: {
        value: serialized,
        updatedBy: adminUserId,
      },
    })
    updatedKeys.push(definition.key)

    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.settings.update",
      resourceType: "ingestion_setting",
      resourceId: definition.key,
      details: {
        oldValue: oldEffective,
        newValue: definition.secret ? "***" : serialized,
        parsed: definition.secret ? "***" : parsed,
      },
      ipAddress,
      userAgent,
    })
  }

  await reloadIngestionSettingsCaches()
  const settings = await listAdminIngestionSettings()

  return { updated: updatedKeys, settings }
}

export async function resetAdminIngestionSetting(
  key: string,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AdminIngestionSettingsResponse> {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new Error(`Unknown setting key: ${key}`)
  }
  if (!definition.writable) {
    throw new Error(`${key} is read-only`)
  }

  const existing = await prisma.ingestionSetting.findUnique({ where: { key } })
  if (existing) {
    await prisma.ingestionSetting.delete({ where: { key } })
    await createAuditLog({
      userId: adminUserId,
      action: "ingestion.settings.reset",
      resourceType: "ingestion_setting",
      resourceId: key,
      details: { oldValue: existing.value, newValue: null },
      ipAddress,
      userAgent,
    })
  }

  await reloadIngestionSettingsCaches()
  return listAdminIngestionSettings()
}

export function getAppSettingPreview(key: string): AdminIngestionSetting | undefined {
  const definition = getSettingDefinition(key)
  if (!definition || definition.scope !== "app") {
    return undefined
  }
  return resolveSetting(definition, new Map())
}
