/**
 * @fileoverview Tests for getEventSummary function
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Regression tests to ensure getEventSummary uses database aggregations
 *              and does not load full event graph (races, results, laps)
 * 
 * @purpose Validates that getEventSummary makes < 5 queries regardless of event size.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getEventSummary } from "@/core/events/get-event-analysis-data"
import { prisma } from "@/lib/prisma"

interface MockEventSummary {
  id: string
  eventName: string
  eventDate: Date
  track: {
    trackName: string
  }
}

interface MockRaceAggregate {
  _count: { id: number }
  _min: { startTime: Date | null }
  _max: { startTime: Date | null }
}

interface MockLapAggregate {
  _count: { id: number }
}

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    race: {
      aggregate: vi.fn(),
    },
    raceDriver: {
      groupBy: vi.fn(),
    },
    lap: {
      aggregate: vi.fn(),
    },
  },
}))

describe("getEventSummary - Query Count Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should make < 5 queries regardless of event size", async () => {
    const eventId = "event-123"

    // Mock event metadata query
    const mockEvent: MockEventSummary = {
      id: eventId,
      eventName: "Test Event",
      eventDate: new Date("2025-01-15"),
      track: {
        trackName: "Test Track",
      },
    }
    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never)

    // Mock race aggregate query
    const raceAggregate: MockRaceAggregate = {
      _count: { id: 12 },
      _min: { startTime: new Date("2025-01-15T09:00:00Z") },
      _max: { startTime: new Date("2025-01-15T17:00:00Z") },
    }
    vi.mocked(prisma.race.aggregate).mockResolvedValue(raceAggregate as never)

    // Mock distinct drivers query
    vi.mocked(prisma.raceDriver.groupBy).mockResolvedValue([
      { driverId: "driver-1" },
      { driverId: "driver-2" },
      { driverId: "driver-3" },
    ] as never)

    // Mock lap aggregate query
    const lapAggregate: MockLapAggregate = {
      _count: { id: 1500 },
    }
    vi.mocked(prisma.lap.aggregate).mockResolvedValue(lapAggregate as never)

    await getEventSummary(eventId)

    // Count total Prisma query calls
    const queryCount =
      (vi.mocked(prisma.event.findUnique).mock.calls.length || 0) +
      (vi.mocked(prisma.race.aggregate).mock.calls.length || 0) +
      (vi.mocked(prisma.raceDriver.groupBy).mock.calls.length || 0) +
      (vi.mocked(prisma.lap.aggregate).mock.calls.length || 0)

    expect(queryCount).toBeLessThan(5)
    expect(queryCount).toBe(4) // Should be exactly 4 queries
  })

  it("should not load lap data in memory", async () => {
    const eventId = "event-123"

    const mockEvent: MockEventSummary = {
      id: eventId,
      eventName: "Test Event",
      eventDate: new Date("2025-01-15"),
      track: {
        trackName: "Test Track",
      },
    }
    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never)

    const raceAggregate: MockRaceAggregate = {
      _count: { id: 12 },
      _min: { startTime: new Date("2025-01-15T09:00:00Z") },
      _max: { startTime: new Date("2025-01-15T17:00:00Z") },
    }
    vi.mocked(prisma.race.aggregate).mockResolvedValue(raceAggregate as never)

    vi.mocked(prisma.raceDriver.groupBy).mockResolvedValue([] as never)

    const lapAggregate: MockLapAggregate = {
      _count: { id: 1500 },
    }
    vi.mocked(prisma.lap.aggregate).mockResolvedValue(lapAggregate as never)

    await getEventSummary(eventId)

    // Verify that we never call findMany with include for laps
    // (which would load full lap data)
    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: { id: eventId },
      select: expect.objectContaining({
        id: true,
        eventName: true,
        eventDate: true,
        track: expect.objectContaining({
          select: expect.objectContaining({
            trackName: true,
          }),
        }),
      }),
    })

    // Verify we use aggregate instead of loading laps
    expect(prisma.lap.aggregate).toHaveBeenCalled()
  })
})
