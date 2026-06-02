/**
 * @fileoverview Tests for cross-track event browse core logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  browseEvents,
  clampBrowsePage,
  clampBrowsePageSize,
  BROWSE_DEFAULT_PAGE_SIZE,
  BROWSE_MAX_PAGE_SIZE,
} from "@/core/events/browse-events"
import { browseEventsInDatabase } from "@/core/events/repo"
import { validateBrowseEventsParams } from "@/core/events/validate"

vi.mock("@/core/events/repo", () => ({
  browseEventsInDatabase: vi.fn(),
}))

vi.mock("@/core/events/validate", () => ({
  validateBrowseEventsParams: vi.fn(),
}))

describe("browse-events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("clampBrowsePageSize", () => {
    it("defaults when undefined", () => {
      expect(clampBrowsePageSize(undefined)).toBe(BROWSE_DEFAULT_PAGE_SIZE)
    })

    it("clamps to max", () => {
      expect(clampBrowsePageSize(500)).toBe(BROWSE_MAX_PAGE_SIZE)
    })
  })

  describe("clampBrowsePage", () => {
    it("defaults to page 1", () => {
      expect(clampBrowsePage(undefined)).toBe(1)
      expect(clampBrowsePage(0)).toBe(1)
    })
  })

  describe("browseEvents", () => {
    it("calls repo with parsed dates and databaseOnly", async () => {
      vi.mocked(validateBrowseEventsParams).mockReturnValue(null)
      vi.mocked(browseEventsInDatabase).mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        pageSize: 50,
      })

      await browseEvents({
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        page: 2,
        pageSize: 25,
        databaseOnly: true,
      })

      expect(browseEventsInDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 25,
          databaseOnly: true,
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      )
    })

    it("throws validation errors from validateBrowseEventsParams", async () => {
      vi.mocked(validateBrowseEventsParams).mockReturnValue({
        code: "VALIDATION_ERROR",
        message: "start_date must be a valid date",
        field: "start_date",
      })

      await expect(browseEvents({ startDate: "bad", endDate: "2025-01-01" })).rejects.toMatchObject(
        {
          code: "VALIDATION_ERROR",
          field: "start_date",
        }
      )
    })
  })
})
