/**
 * @fileoverview Tests for ingestion status recovery helpers
 */

import { describe, expect, it, vi } from "vitest"

import {
  isRecoverableIngestionError,
  waitForIngestionCompletion,
  type EventLikeRecord,
} from "@/lib/ingestion-status"

describe("isRecoverableIngestionError", () => {
  it("returns true for AbortError", () => {
    const error = new Error("aborted")
    error.name = "AbortError"
    expect(isRecoverableIngestionError(error)).toBe(true)
  })

  it("returns true for network style errors", () => {
    expect(isRecoverableIngestionError(new Error("fetch failed"))).toBe(true)
    expect(isRecoverableIngestionError(new Error("ECONNREFUSED"))).toBe(true)
    expect(isRecoverableIngestionError(new Error("Timeout while waiting"))).toBe(true)
  })

  it("returns false for non Error inputs", () => {
    expect(isRecoverableIngestionError("boom")).toBe(false)
  })

  it("returns false for non-transient errors", () => {
    expect(isRecoverableIngestionError(new Error("Validation failed"))).toBe(false)
  })
})

describe("waitForIngestionCompletion", () => {
  it("resolves when event reaches the desired depth", async () => {
    const events: Array<EventLikeRecord | null> = [
      { id: "evt", ingestDepth: "none", lastIngestedAt: null },
      { id: "evt", ingestDepth: "laps_full", lastIngestedAt: new Date() },
    ]

    const fetchEvent = vi.fn().mockImplementation(async () => events.shift() ?? null)

    const result = await waitForIngestionCompletion({
      fetchEvent,
      eventId: "evt",
      attempts: 3,
      delayMs: 10,
    })

    expect(result?.ingestDepth).toBe("laps_full")
    expect(fetchEvent).toHaveBeenCalledTimes(2)
  })

  it("returns null when depth is never reached", async () => {
    const fetchEvent = vi.fn().mockResolvedValue({
      id: "evt",
      ingestDepth: "none",
      lastIngestedAt: null,
    })

    const result = await waitForIngestionCompletion({
      fetchEvent,
      eventId: "evt",
      attempts: 2,
      delayMs: 1,
    })

    expect(result).toBeNull()
    expect(fetchEvent).toHaveBeenCalledTimes(2)
  })
})

