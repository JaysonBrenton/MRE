/**
 * @fileoverview Tests for getRaceWithResults function
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Regression tests to ensure getRaceWithResults uses batched queries
 *              and does not make per-driver queries (N+1 problem)
 * 
 * @purpose Validates that getRaceWithResults makes < 10 queries for a 60-driver race.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getRaceWithResults } from "@/core/races/repo"
import { getTranspondersForRaceBatch } from "@/core/drivers/repo"
import { prisma } from "@/lib/prisma"

interface MockRaceResult {
  id: string
  raceDriverId: string
  positionFinal: number
  lapsCompleted?: number
  totalTimeSeconds?: number
  fastLapTime?: number
  avgLapTime?: number
  consistency?: number
  raceDriver: {
    id: string
    driverId: string
    displayName: string
    driver: {
      id: string
      displayName: string
    }
  }
}

interface MockRace {
  id: string
  eventId: string
  className: string
  raceOrder: number
  event: {
    id: string
    eventName: string
  }
  results: MockRaceResult[]
}

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    race: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock the batch helper
vi.mock("@/core/drivers/repo", () => ({
  getTranspondersForRaceBatch: vi.fn(),
}))

describe("getRaceWithResults - Query Count Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should make < 10 queries for a 60-driver race", async () => {
    const raceId = "race-123"
    const eventId = "event-123"
    const className = "Mod"

    // Create 60 mock results
    const mockResults: MockRaceResult[] = Array.from({ length: 60 }, (_, i) => ({
      id: `result-${i}`,
      raceDriverId: `race-driver-${i}`,
      positionFinal: i + 1,
      lapsCompleted: 20,
      totalTimeSeconds: 1200 + i,
      fastLapTime: 60 + i * 0.1,
      avgLapTime: 61 + i * 0.1,
      consistency: 90 + i * 0.1,
      raceDriver: {
        id: `race-driver-${i}`,
        driverId: `driver-${i}`,
        displayName: `Driver ${i}`,
        driver: {
          id: `driver-${i}`,
          displayName: `Driver ${i}`,
        },
      },
    }))

    // Mock race query
    const mockRace: MockRace = {
      id: raceId,
      eventId,
      className,
      raceOrder: 1,
      event: {
        id: eventId,
        eventName: "Test Event",
      },
      results: mockResults,
    }
    vi.mocked(prisma.race.findUnique).mockResolvedValue(mockRace as never)

    // Mock batch transponder lookup
    const transponderMap = new Map<string, { transponderNumber: string; source: 'entry_list' }>()
    mockResults.forEach((result) => {
      transponderMap.set(result.raceDriver.driverId, {
        transponderNumber: `T${result.raceDriver.driverId}`,
        source: "entry_list" as const,
      })
    })
    vi.mocked(getTranspondersForRaceBatch).mockResolvedValue(transponderMap)

    await getRaceWithResults(raceId)

    // Count Prisma query calls
    const queryCount = vi.mocked(prisma.race.findUnique).mock.calls.length

    // Should only make 1 query to get race + results
    expect(queryCount).toBe(1)
    expect(queryCount).toBeLessThan(10)

    // Verify batch helper was called once (not 60 times)
    expect(getTranspondersForRaceBatch).toHaveBeenCalledTimes(1)
    expect(getTranspondersForRaceBatch).toHaveBeenCalledWith(
      expect.arrayContaining(mockResults.map((r) => r.raceDriver.driverId)),
      eventId,
      raceId,
      1, // raceOrder
      className
    )
  })

  it("should use batched transponder lookup instead of per-driver calls", async () => {
    const raceId = "race-123"
    const eventId = "event-123"

    const mockRace: MockRace = {
      id: raceId,
      eventId,
      className: "Mod",
      raceOrder: 1,
      event: {
        id: eventId,
        eventName: "Test Event",
      },
      results: [
        {
          id: "result-1",
          raceDriverId: "race-driver-1",
          positionFinal: 1,
          raceDriver: {
            id: "race-driver-1",
            driverId: "driver-1",
            displayName: "Driver 1",
            driver: {
              id: "driver-1",
              displayName: "Driver 1",
            },
          },
        },
      ],
    }
    vi.mocked(prisma.race.findUnique).mockResolvedValue(mockRace as never)

    const transponderMap = new Map<string, { transponderNumber: string; source: 'entry_list' }>([
      [
        "driver-1",
        {
          transponderNumber: "T123",
          source: "entry_list" as const,
        },
      ],
    ])
    vi.mocked(getTranspondersForRaceBatch).mockResolvedValue(transponderMap)

    const result = await getRaceWithResults(raceId)

    expect(result).not.toBeNull()
    expect(getTranspondersForRaceBatch).toHaveBeenCalledTimes(1)
    // Verify we don't call getTransponderForRace (the old per-driver function)
    // by checking that we only call the batch version
  })
})
