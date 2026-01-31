/**
 * @fileoverview Driver name matching logic (exact + fuzzy)
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Implements exact and fuzzy driver name matching,
 *              filtering to only drivers with valid lap times
 */

import { prisma } from "@/lib/prisma"
import type { Driver } from "@prisma/client"

/**
 * Find drivers with exact name match (case-insensitive)
 */
export async function findDriversExactMatch(name: string): Promise<Driver[]> {
  if (!name || name.trim() === "") {
    return []
  }

  const normalizedName = name.trim().toLowerCase()

  const drivers = await prisma.driver.findMany({
    where: {
      OR: [
        {
          displayName: {
            equals: name.trim(),
            mode: "insensitive",
          },
        },
        {
          normalizedName: {
            equals: normalizedName,
            mode: "insensitive",
          },
        },
      ],
    },
  })

  return drivers
}

/**
 * Simple fuzzy matching using case-insensitive contains
 * Falls back to this if exact match returns no results
 */
export async function findDriversFuzzyMatch(name: string): Promise<Driver[]> {
  if (!name || name.trim() === "") {
    return []
  }

  const searchTerm = name.trim().toLowerCase()

  const drivers = await prisma.driver.findMany({
    where: {
      OR: [
        {
          displayName: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          normalizedName: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ],
    },
    take: 20, // Limit fuzzy results
  })

  return drivers
}

/**
 * Find drivers matching name (exact first, then fuzzy) who have valid lap times
 */
export async function findDriversWithValidLaps(driverName: string): Promise<Driver[]> {
  if (!driverName || driverName.trim() === "") {
    return []
  }

  // Try exact match first
  let drivers = await findDriversExactMatch(driverName)

  // If no exact match, try fuzzy
  if (drivers.length === 0) {
    drivers = await findDriversFuzzyMatch(driverName)
  }

  if (drivers.length === 0) {
    return []
  }

  const driverIds = drivers.map((d) => d.id)

  // Filter to only drivers with valid lap times
  const driversWithValidLaps = await prisma.driver.findMany({
    where: {
      id: {
        in: driverIds,
      },
      raceDrivers: {
        some: {
          results: {
            some: {
              laps: {
                some: {
                  lapTimeSeconds: {
                    gt: 0,
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  return driversWithValidLaps
}
