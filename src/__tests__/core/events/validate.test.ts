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
import { validateEventSearchParams } from "@/core/events/validate"

describe("validateEventSearchParams", () => {
  describe("valid parameters", () => {
    it("should return null for valid parameters", () => {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 30) // 30 days ago
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        "track-id-123",
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).toBeNull()
    })

    it("should accept date range at maximum 90 days", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 90) // Exactly 90 days ago
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        "track-id-123",
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
      const result = validateEventSearchParams("track-id-123", null, today.toISOString())

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("start_date is required when end_date is provided")
      expect(result?.field).toBe("start_date")
    })

    it("should return error when endDate is missing", () => {
      const today = new Date()
      const result = validateEventSearchParams("track-id-123", today.toISOString(), null)

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("end_date is required when start_date is provided")
      expect(result?.field).toBe("end_date")
    })
  })

  describe("invalid date formats", () => {
    it("should return error for invalid startDate format", () => {
      const today = new Date()
      const result = validateEventSearchParams("track-id-123", "invalid-date", today.toISOString())

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toBe("start_date must be a valid date")
      expect(result?.field).toBe("start_date")
    })

    it("should return error for invalid endDate format", () => {
      const today = new Date()
      const result = validateEventSearchParams("track-id-123", today.toISOString(), "invalid-date")

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
        "track-id-123",
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

      const result = validateEventSearchParams("track-id-123", dateStr, dateStr)

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
        "track-id-123",
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
        "track-id-123",
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

      const result = validateEventSearchParams("track-id-123", dateStr, dateStr)

      expect(result).toBeNull()
    })
  })

  describe("max date range validation", () => {
    it("should return error when date range exceeds 90 days", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 91) // 91 days ago (exceeds limit)
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        "track-id-123",
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).not.toBeNull()
      expect(result?.code).toBe("VALIDATION_ERROR")
      expect(result?.message).toContain("90 days")
      expect(result?.message).toContain("3 months")
      expect(result?.field).toBe("end_date")
    })

    it("should accept exactly 90 days", () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 90) // Exactly 90 days
      const endDate = new Date(today)

      const result = validateEventSearchParams(
        "track-id-123",
        startDate.toISOString(),
        endDate.toISOString()
      )

      expect(result).toBeNull()
    })
  })
})
