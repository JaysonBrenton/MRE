/**
 * @fileoverview Tests for event validation logic
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for event search parameter validation
 *
 * @purpose Validates date range validation logic including edge cases.
 */

import { describe, it, expect } from "vitest"
import { getEventSearchEarliestSelectableDate, toLocalDateString } from "@/lib/date-utils"
import { validateEventSearchParams } from "@/core/events/validate"

const VALID_TRACK_ID = "a1b2c3d4-e5f6-4789-a012-345678901234"

describe("validateEventSearchParams", () => {
  describe("valid parameters", () => {
    it("should return null for valid parameters", () => {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 30) // 30 days ago
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).toBeNull()
    })

    it("should accept a 90-day span within the lookback window", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 90) // Exactly 90 days ago
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).toBeNull()
    })
  })

  describe("missing required fields", () => {
    it("should return error when trackId is missing", () => {
      const today = new Date()
      const result = validateEventSearchParams(null, today.toISOString(), today.toISOString())

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("track_id is required")
      expect(result?.field).toBe("track_id")
    })

    it("should return error when startDate is missing", () => {
      const today = new Date()
      const result = validateEventSearchParams(VALID_TRACK_ID, null, today.toISOString())

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("start_date is required when end_date is provided")
      expect(result?.field).toBe("start_date")
    })

    it("should return error when endDate is missing", () => {
      const today = new Date()
      const result = validateEventSearchParams(VALID_TRACK_ID, today.toISOString(), null)

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("end_date is required when start_date is provided")
      expect(result?.field).toBe("end_date")
    })
  })

  describe("invalid date formats", () => {
    it("should return error for invalid startDate format", () => {
      const today = new Date()
      const result = validateEventSearchParams(VALID_TRACK_ID, "invalid-date", today.toISOString())

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("start_date must be a valid date")
      expect(result?.field).toBe("start_date")
    })

    it("should return error for invalid endDate format", () => {
      const today = new Date()
      const result = validateEventSearchParams(VALID_TRACK_ID, today.toISOString(), "invalid-date")

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("end_date must be a valid date")
      expect(result?.field).toBe("end_date")
    })
  })

  describe("date range validation", () => {
    it("should return error when startDate is after endDate", () => {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() + 5) // 5 days in the future
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("start_date must be before or equal to end_date")
      expect(result?.field).toBe("start_date")
    })

    it("should accept equal start and end dates", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dateStr = today.toISOString()

      const result = validateEventSearchParams(VALID_TRACK_ID, dateStr, dateStr)

      expect(result).toBeNull()
    })
  })

  describe("7 year lookback", () => {
    it("should reject when start is before the earliest allowed day", () => {
      const earliest = getEventSearchEarliestSelectableDate()
      const before = new Date(earliest)
      before.setDate(before.getDate() - 1)
      const ymd = toLocalDateString(before)
      const result = validateEventSearchParams(VALID_TRACK_ID, ymd, ymd)
      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toContain("7 year")
      expect(result?.field).toBe("start_date")
    })

    it("should accept start and end on the earliest allowed day", () => {
      const ymd = toLocalDateString(getEventSearchEarliestSelectableDate())
      const result = validateEventSearchParams(VALID_TRACK_ID, ymd, ymd)
      expect(result).toBeNull()
    })
  })

  describe("future date rejection", () => {
    it("should return error when startDate is in the future", () => {
      const today = new Date()
      const futureDate = new Date(today)
      futureDate.setDate(today.getDate() + 1) // Tomorrow
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        futureDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      // The validation checks start > end first, so this error comes first
      expect(result?.message).toContain("start_date must be before or equal to end_date")
      expect(result?.field).toBe("start_date")
    })

    it("should return error when endDate is in the future", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 10) // 10 days ago
      const futureDate = new Date(today)
      futureDate.setDate(today.getDate() + 1) // Tomorrow

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        startDate.toISOString(),
        futureDate.toISOString()
      )

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toContain("Cannot select future dates")
      expect(result?.field).toBe("end_date")
    })

    it("should accept today as valid", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dateStr = today.toISOString()

      const result = validateEventSearchParams(VALID_TRACK_ID, dateStr, dateStr)

      expect(result).toBeNull()
    })
  })

  describe("wide date range within lookback", () => {
    it("should accept range from earliest selectable day through today", () => {
      const startYmd = toLocalDateString(getEventSearchEarliestSelectableDate())
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const endYmd = toLocalDateString(today)

      const result = validateEventSearchParams(VALID_TRACK_ID, startYmd, endYmd)

      expect(result).toBeNull()
    })

    it("should accept a multi-year span when both dates are within the lookback window", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 500)
      const endDate = new Date(today)
      endDate.setDate(today.getDate() - 100)

      const result = validateEventSearchParams(
        VALID_TRACK_ID,
        toLocalDateString(startDate),
        toLocalDateString(endDate)
      )

      expect(result).toBeNull()
    })
  })
})
