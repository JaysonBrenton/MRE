/**
 * @fileoverview Tests for driver links core domain logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tests read-only link retrieval logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { getUserDriverLinks, getUserLinkedDrivers, getUserLinkedEvents } from "@/core/users/driver-links"
import { prisma } from "@/lib/prisma"
import type { Prisma, UserDriverLinkStatus, EventDriverLinkMatchType } from "@prisma/client"

const STATUS: Record<
  "CONFIRMED" | "SUGGESTED" | "CONFLICT",
  UserDriverLinkStatus
> = {
  CONFIRMED: "confirmed" as UserDriverLinkStatus,
  SUGGESTED: "suggested" as UserDriverLinkStatus,
  CONFLICT: "conflict" as UserDriverLinkStatus,
}

const MATCH_TYPE: Record<"EXACT" | "FUZZY" | "TRANSPONDER", EventDriverLinkMatchType> = {
  EXACT: "exact" as EventDriverLinkMatchType,
  FUZZY: "fuzzy" as EventDriverLinkMatchType,
  TRANSPONDER: "transponder" as EventDriverLinkMatchType,
}

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userDriverLink: {
      findMany: vi.fn(),
    },
    eventDriverLink: {
      findMany: vi.fn(),
    },
  },
}))

describe("getUserDriverLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should retrieve and format user driver links", async () => {
    const mockLinks = [
      {
        id: "link-1",
        driverId: "driver-1",
        driver: {
          id: "driver-1",
          source: "liverc",
          sourceDriverId: "liverc-driver-1",
          displayName: "Jayson Brenton",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.CONFIRMED,
        similarityScore: 0.95,
        matchedAt: new Date("2025-01-01"),
        confirmedAt: new Date("2025-01-01"),
        rejectedAt: null,
        conflictReason: null,
        events: [
          {
            id: "event-link-1",
            matchType: MATCH_TYPE.EXACT,
          },
        ],
      },
      {
        id: "link-2",
        driverId: "driver-2",
        driver: {
          id: "driver-2",
          source: "liverc",
          sourceDriverId: "liverc-driver-2",
          displayName: "John Doe",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.SUGGESTED,
        similarityScore: 0.87,
        matchedAt: new Date("2025-01-02"),
        confirmedAt: null,
        rejectedAt: null,
        conflictReason: null,
        events: [
          {
            id: "event-link-2",
            matchType: MATCH_TYPE.FUZZY,
          },
        ],
      },
    ]

    vi.mocked(prisma.userDriverLink.findMany).mockResolvedValue(
      mockLinks as unknown as Prisma.UserDriverLinkGetPayload<{
        include: { driver: true; events: { select: { id: true; matchType: true } } }
      }>[]
    )

    const result = await getUserDriverLinks("user-1")

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      driverId: "driver-1",
      driverName: "Jayson Brenton",
      status: "confirmed",
      similarityScore: 0.95,
      eventCount: 1, // events array length, not _count.events
      matchType: "exact", // string, not enum
    })
    expect(result[1]).toMatchObject({
      driverId: "driver-2",
      driverName: "John Doe",
      status: "suggested",
      similarityScore: 0.87,
      eventCount: 1, // events array length
      matchType: "fuzzy", // string, not enum
    })
  })

  it("should handle links with no events", async () => {
    const mockLinks = [
      {
        id: "link-1",
        driverId: "driver-1",
        driver: {
          id: "driver-1",
          source: "liverc",
          sourceDriverId: "liverc-driver-1",
          displayName: "Jayson Brenton",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.SUGGESTED,
        similarityScore: 0.85,
        matchedAt: new Date("2025-01-01"),
        confirmedAt: null,
        rejectedAt: null,
        conflictReason: null,
        events: [],
      },
    ]

    vi.mocked(prisma.userDriverLink.findMany).mockResolvedValue(
      mockLinks as unknown as Prisma.UserDriverLinkGetPayload<{
        include: { driver: true; events: { select: { id: true; matchType: true } } }
      }>[]
    )

    const result = await getUserDriverLinks("user-1")

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      eventCount: 0,
      matchType: "fuzzy", // default when no events
    })
  })

  it("should handle conflict reasons", async () => {
    const mockLinks = [
      {
        id: "link-1",
        driverId: "driver-1",
        driver: {
          id: "driver-1",
          source: "liverc",
          sourceDriverId: "liverc-driver-1",
          displayName: "Jayson Brenton",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.CONFLICT,
        similarityScore: 0.5,
        matchedAt: new Date("2025-01-01"),
        confirmedAt: null,
        rejectedAt: new Date("2025-01-01"),
        conflictReason: "Transponder match but low name compatibility",
        events: [
          {
            id: "event-link-1",
            matchType: MATCH_TYPE.TRANSPONDER,
          },
        ],
      },
    ]

    vi.mocked(prisma.userDriverLink.findMany).mockResolvedValue(
      mockLinks as unknown as Prisma.UserDriverLinkGetPayload<{
        include: { driver: true; events: { select: { id: true; matchType: true } } }
      }>[]
    )

    const result = await getUserDriverLinks("user-1")

    expect(result[0].conflictReason).toBe("Transponder match but low name compatibility")
  })
})

describe("getUserLinkedDrivers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should retrieve only confirmed and suggested drivers", async () => {
    const mockLinks = [
      {
        driverId: "driver-1",
        driver: {
          id: "driver-1",
          source: "liverc",
          sourceDriverId: "liverc-driver-1",
          displayName: "Jayson Brenton",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.CONFIRMED,
        similarityScore: 0.95,
        matchedAt: new Date("2025-01-01"),
        confirmedAt: new Date("2025-01-01"),
        rejectedAt: null,
        conflictReason: null,
        events: [],
      },
      {
        driverId: "driver-2",
        driver: {
          id: "driver-2",
          source: "liverc",
          sourceDriverId: "liverc-driver-2",
          displayName: "John Doe",
          normalizedName: null,
          transponderNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        status: STATUS.SUGGESTED,
        similarityScore: 0.87,
        matchedAt: new Date("2025-01-02"),
        confirmedAt: null,
        rejectedAt: null,
        conflictReason: null,
        events: [],
      },
    ]

    vi.mocked(prisma.userDriverLink.findMany).mockResolvedValue(
      mockLinks as unknown as Prisma.UserDriverLinkGetPayload<{
        include: { driver: true; events: { select: { id: true; matchType: true } } }
      }>[]
    )

    const result = await getUserLinkedDrivers("user-1")

    // getUserLinkedDrivers calls getUserDriverLinks internally, which uses a different query
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      driverId: "driver-1",
      driverName: "Jayson Brenton",
      status: "confirmed",
    })
    expect(result[1]).toMatchObject({
      driverId: "driver-2",
      driverName: "John Doe",
      status: "suggested",
    })
  })
})

describe("getUserLinkedEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should retrieve events for linked drivers", async () => {
    const mockEventLinks: Array<{ eventId: string }> = [
      {
        eventId: "event-1",
      },
      {
        eventId: "event-2",
      },
    ]

    vi.mocked(prisma.eventDriverLink.findMany).mockResolvedValue(
      mockEventLinks as any
    )

    const result = await getUserLinkedEvents("user-1")

    expect(result).toHaveLength(2)
    expect(result[0]).toBe("event-1")
    expect(result[1]).toBe("event-2")
  })
})
