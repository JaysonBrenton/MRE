/**
 * @fileoverview Serialize and parse ingestion setting values for DB storage
 */

import type {
  IngestionSettingDefinition,
  IngestionSettingType,
} from "@/core/admin/ingestion-settings-registry"

export type SettingValue = string | number | boolean

export function parseBoolean(raw: string): boolean {
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase())
}

export function parseStoredValue(
  definition: Pick<IngestionSettingDefinition, "type">,
  raw: string
): SettingValue {
  switch (definition.type) {
    case "boolean":
      return parseBoolean(raw)
    case "integer":
      return Number.parseInt(raw, 10)
    case "number":
      return Number.parseFloat(raw)
    default:
      return raw
  }
}

export function parseEnvValue(
  definition: Pick<IngestionSettingDefinition, "type">,
  raw: string
): SettingValue {
  return parseStoredValue(definition, raw)
}

export function serializeSettingValue(
  definition: Pick<IngestionSettingDefinition, "type">,
  value: SettingValue
): string {
  if (definition.type === "boolean") {
    return value ? "true" : "false"
  }
  return String(value)
}

export function maskSecretValue(key: string, value: SettingValue, secret?: boolean): SettingValue {
  if (!secret) return value
  if (key === "DATABASE_URL" && typeof value === "string" && value.length > 0) {
    return "postgresql://***"
  }
  return "***"
}

export function formatValueForDisplay(value: SettingValue): string {
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return String(value)
}

export function valuesEqual(a: SettingValue, b: SettingValue, type: IngestionSettingType): boolean {
  if (type === "boolean") return Boolean(a) === Boolean(b)
  if (type === "integer") return Number.parseInt(String(a), 10) === Number.parseInt(String(b), 10)
  if (type === "number") return Number.parseFloat(String(a)) === Number.parseFloat(String(b))
  return String(a) === String(b)
}
