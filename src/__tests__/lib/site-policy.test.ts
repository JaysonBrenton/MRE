/**
 * @fileoverview Tests for scraping kill-switch enforcement
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for assertScrapingEnabled and isScrapingEnabled functions
 *              to ensure kill-switch blocks all ingestion paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { assertScrapingEnabled, isScrapingEnabled } from "@/lib/site-policy"
import { ingestionClient } from "@/lib/ingestion-client"
import { triggerEventIngestion, triggerTrackSync } from "@/core/admin/ingestion"

describe("Scraping Kill-Switch", () => {
  const originalEnv = process.env.MRE_SCRAPE_ENABLED

  beforeEach(() => {
    // Clear environment variable before each test
    delete process.env.MRE_SCRAPE_ENABLED
  })

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.MRE_SCRAPE_ENABLED = originalEnv
    } else {
      delete process.env.MRE_SCRAPE_ENABLED
    }
  })

  describe("isScrapingEnabled", () => {
    it("should return true when MRE_SCRAPE_ENABLED is not set", () => {
      expect(isScrapingEnabled()).toBe(true)
    })

    it("should return true when MRE_SCRAPE_ENABLED is 'true'", () => {
      process.env.MRE_SCRAPE_ENABLED = "true"
      expect(isScrapingEnabled()).toBe(true)
    })

    it("should return true when MRE_SCRAPE_ENABLED is '1'", () => {
      process.env.MRE_SCRAPE_ENABLED = "1"
      expect(isScrapingEnabled()).toBe(true)
    })

    it("should return false when MRE_SCRAPE_ENABLED is 'false'", () => {
      process.env.MRE_SCRAPE_ENABLED = "false"
      expect(isScrapingEnabled()).toBe(false)
    })

    it("should return false when MRE_SCRAPE_ENABLED is '0'", () => {
      process.env.MRE_SCRAPE_ENABLED = "0"
      expect(isScrapingEnabled()).toBe(false)
    })

    it("should return false when MRE_SCRAPE_ENABLED is 'off'", () => {
      process.env.MRE_SCRAPE_ENABLED = "off"
      expect(isScrapingEnabled()).toBe(false)
    })

    it("should return false when MRE_SCRAPE_ENABLED is 'no'", () => {
      process.env.MRE_SCRAPE_ENABLED = "no"
      expect(isScrapingEnabled()).toBe(false)
    })

    it("should handle case-insensitive values", () => {
      process.env.MRE_SCRAPE_ENABLED = "FALSE"
      expect(isScrapingEnabled()).toBe(false)

      process.env.MRE_SCRAPE_ENABLED = "True"
      expect(isScrapingEnabled()).toBe(true)
    })

    it("should trim whitespace", () => {
      process.env.MRE_SCRAPE_ENABLED = " false "
      expect(isScrapingEnabled()).toBe(false)

      process.env.MRE_SCRAPE_ENABLED = " true "
      expect(isScrapingEnabled()).toBe(true)
    })
  })

  describe("assertScrapingEnabled", () => {
    it("should not throw when scraping is enabled", () => {
      process.env.MRE_SCRAPE_ENABLED = "true"
      expect(() => assertScrapingEnabled()).not.toThrow()
    })

    it("should throw when scraping is disabled", () => {
      process.env.MRE_SCRAPE_ENABLED = "false"
      expect(() => assertScrapingEnabled()).toThrow(
        "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
      )
    })

    it("should throw with correct error message", () => {
      process.env.MRE_SCRAPE_ENABLED = "0"
      try {
        assertScrapingEnabled()
        expect.fail("Should have thrown")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
        )
      }
    })
  })

  describe("kill-switch enforcement in ingestionClient.ingestEvent", () => {
    it("should throw when MRE_SCRAPE_ENABLED=false", async () => {
      process.env.MRE_SCRAPE_ENABLED = "false"

      await expect(ingestionClient.ingestEvent("event-123", "laps_full")).rejects.toThrow(
        "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
      )
    })

    it("should not throw when MRE_SCRAPE_ENABLED is not set", async () => {
      // Mock fetch to prevent actual HTTP calls
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error (expected in test)"))

      try {
        await expect(ingestionClient.ingestEvent("event-123", "laps_full")).rejects.toThrow(
          "Network error (expected in test)"
        )
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe("kill-switch enforcement in ingestionClient.ingestEventBySourceId", () => {
    it("should throw when MRE_SCRAPE_ENABLED=false", async () => {
      process.env.MRE_SCRAPE_ENABLED = "false"

      await expect(
        ingestionClient.ingestEventBySourceId("source-123", "track-123", "laps_full")
      ).rejects.toThrow(
        "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
      )
    })

    it("should not throw when MRE_SCRAPE_ENABLED is not set", async () => {
      // Mock fetch to prevent actual HTTP calls
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error (expected in test)"))

      try {
        await expect(
          ingestionClient.ingestEventBySourceId("source-123", "track-123", "laps_full")
        ).rejects.toThrow("Network error (expected in test)")
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe("kill-switch enforcement in triggerEventIngestion", () => {
    it("should throw when MRE_SCRAPE_ENABLED=false", async () => {
      process.env.MRE_SCRAPE_ENABLED = "false"

      await expect(triggerEventIngestion("event-123", "admin-user-123")).rejects.toThrow(
        "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
      )
    })

    it("should not throw when MRE_SCRAPE_ENABLED is not set", async () => {
      // Mock fetch and audit log to prevent actual calls
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error (expected in test)"))

      try {
        await expect(triggerEventIngestion("event-123", "admin-user-123")).rejects.toThrow(
          "Network error (expected in test)"
        )
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe("kill-switch enforcement in triggerTrackSync", () => {
    it("should throw when MRE_SCRAPE_ENABLED=false", async () => {
      process.env.MRE_SCRAPE_ENABLED = "false"

      await expect(triggerTrackSync("admin-user-123")).rejects.toThrow(
        "LiveRC scraping is temporarily disabled by operations. Try again once MRE_SCRAPE_ENABLED is restored."
      )
    })

    it("should not throw when MRE_SCRAPE_ENABLED is not set", async () => {
      // Mock fetch and audit log to prevent actual calls
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error (expected in test)"))

      try {
        await expect(triggerTrackSync("admin-user-123")).rejects.toThrow(
          "Network error (expected in test)"
        )
      } finally {
        global.fetch = originalFetch
      }
    })
  })
})
