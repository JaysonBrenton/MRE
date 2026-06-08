/**
 * @fileoverview Tests for ingestion settings validation
 */

import { describe, it, expect } from "vitest"
import {
  assertConfirmations,
  IngestionSettingsValidationError,
  validateSettingUpdate,
} from "@/core/admin/ingestion-settings-validation"

describe("ingestion settings validation", () => {
  it("rejects unknown keys", () => {
    expect(() => validateSettingUpdate("NOT_A_KEY", true)).toThrow(IngestionSettingsValidationError)
  })

  it("rejects read-only keys", () => {
    expect(() => validateSettingUpdate("DATABASE_URL", "x")).toThrow(
      IngestionSettingsValidationError
    )
  })

  it("rejects out-of-range integers", () => {
    expect(() => validateSettingUpdate("MRE_RECENT_EVENTS_DAYS", 999)).toThrow(
      IngestionSettingsValidationError
    )
  })

  it("accepts valid runtime updates", () => {
    const result = validateSettingUpdate("MRE_RECENT_EVENTS_DAYS", 14)
    expect(result.parsed).toBe(14)
    expect(result.serialized).toBe("14")
  })

  it("requires confirm token when disabling scrape", () => {
    const validated = validateSettingUpdate("MRE_SCRAPE_ENABLED", false)
    expect(() =>
      assertConfirmations([{ definition: validated.definition, parsed: validated.parsed }])
    ).toThrow(IngestionSettingsValidationError)
    expect(() =>
      assertConfirmations(
        [{ definition: validated.definition, parsed: validated.parsed }],
        "disable_scrape"
      )
    ).not.toThrow()
  })
})
