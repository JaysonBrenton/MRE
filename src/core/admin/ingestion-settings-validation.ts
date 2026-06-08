/**
 * @fileoverview Validation for admin ingestion settings PATCH payloads
 */

import { z } from "zod"
import {
  getSettingDefinition,
  type IngestionSettingDefinition,
} from "@/core/admin/ingestion-settings-registry"
import {
  parseStoredValue,
  serializeSettingValue,
  type SettingValue,
} from "@/core/admin/ingestion-settings-value"
import { validateSitePolicyOverrides } from "@/core/admin/site-policy-merge"

export class IngestionSettingsValidationError extends Error {
  constructor(
    message: string,
    readonly code: string = "VALIDATION_ERROR",
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "IngestionSettingsValidationError"
  }
}

export function isIngestionSettingsWritable(): boolean {
  return process.env.ADMIN_INGESTION_SETTINGS_WRITABLE === "true"
}

const updateSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
})

export const patchBodySchema = z.object({
  updates: z.array(updateSchema).min(1),
  confirmToken: z.string().optional(),
})

export type PatchBody = z.infer<typeof patchBodySchema>

export function validateSettingUpdate(
  key: string,
  value: SettingValue
): { definition: IngestionSettingDefinition; serialized: string; parsed: SettingValue } {
  const definition = getSettingDefinition(key)
  if (!definition) {
    throw new IngestionSettingsValidationError(`Unknown setting key: ${key}`, "VALIDATION_ERROR", {
      field: key,
    })
  }
  if (!definition.writable) {
    throw new IngestionSettingsValidationError(
      `${key} is read-only (${definition.applyMode})`,
      "SETTING_READ_ONLY",
      { field: key }
    )
  }

  let parsed: SettingValue
  try {
    const serializedProbe = serializeSettingValue(definition, value)
    parsed = parseStoredValue(definition, serializedProbe)
  } catch {
    throw new IngestionSettingsValidationError(
      `Invalid value type for ${key}`,
      "VALIDATION_ERROR",
      {
        field: key,
        type: definition.type,
      }
    )
  }

  if (definition.type === "integer" && !Number.isInteger(Number(parsed))) {
    throw new IngestionSettingsValidationError(`${key} must be an integer`, "VALIDATION_ERROR", {
      field: key,
    })
  }

  if (definition.min !== undefined) {
    const numeric = Number(parsed)
    if (numeric < definition.min) {
      throw new IngestionSettingsValidationError(
        `${key} must be at least ${definition.min}`,
        "VALIDATION_ERROR",
        { field: key, min: definition.min, max: definition.max }
      )
    }
  }

  if (definition.max !== undefined) {
    const numeric = Number(parsed)
    if (numeric > definition.max) {
      throw new IngestionSettingsValidationError(
        `${key} must be at most ${definition.max}`,
        "VALIDATION_ERROR",
        { field: key, min: definition.min, max: definition.max }
      )
    }
  }

  if (definition.enumValues && !definition.enumValues.includes(String(parsed))) {
    throw new IngestionSettingsValidationError(
      `${key} must be one of: ${definition.enumValues.join(", ")}`,
      "VALIDATION_ERROR",
      { field: key, enumValues: definition.enumValues }
    )
  }

  if (definition.type === "json") {
    try {
      const parsedJson = JSON.parse(String(parsed))
      if (!parsedJson || typeof parsedJson !== "object") {
        throw new Error("invalid json")
      }
      if (key === "site_policy_overrides") {
        const schemaError = validateSitePolicyOverrides(parsed)
        if (schemaError) {
          throw new IngestionSettingsValidationError(schemaError, "VALIDATION_ERROR", {
            field: key,
          })
        }
      }
    } catch (error) {
      if (error instanceof IngestionSettingsValidationError) {
        throw error
      }
      throw new IngestionSettingsValidationError(`${key} must be valid JSON`, "VALIDATION_ERROR", {
        field: key,
      })
    }
  }

  return {
    definition,
    serialized: serializeSettingValue(definition, parsed),
    parsed,
  }
}

export function assertConfirmations(
  validatedUpdates: Array<{ definition: IngestionSettingDefinition; parsed: SettingValue }>,
  confirmToken?: string
): void {
  for (const { definition, parsed } of validatedUpdates) {
    if (!definition.confirmWhen) continue

    let needsConfirm = false
    if (definition.confirmWhen === "disable_scrape" && definition.key === "MRE_SCRAPE_ENABLED") {
      needsConfirm = parsed === false
    } else if (
      definition.confirmWhen === "unlimited_ingests" &&
      definition.key === "MRE_RECENT_EVENTS_MAX_INGESTS"
    ) {
      needsConfirm = Number(parsed) === 0
    } else if (
      definition.confirmWhen === "disable_queue" &&
      definition.key === "INGESTION_USE_QUEUE"
    ) {
      needsConfirm = parsed === false
    }

    if (needsConfirm && confirmToken !== definition.confirmWhen) {
      throw new IngestionSettingsValidationError(
        `Confirmation required for ${definition.key}`,
        "CONFIRMATION_REQUIRED",
        { field: definition.key, confirmWhen: definition.confirmWhen }
      )
    }
  }
}
