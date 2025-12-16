/**
 * @fileoverview Race repository - all Prisma queries for race domain
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Contains all database access functions for race operations
 * 
 * @purpose This file centralizes all Prisma queries related to races, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/app/api/v1/races/[raceId]/route.ts (uses this repo)
 * - src/app/api/v1/races/[raceId]/laps/route.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { Race, Event, RaceResult, RaceDriver, Lap } from "@prisma/client"

/**
 * Get a race by ID with event
 * 
 * @param raceId - Race's unique identifier
 * @returns Race object with event or null if not found
 */
export async function getRaceById(raceId: string): Promise<(Race & { event: Event }) | null> {
  return prisma.race.findUnique({
    where: { id: raceId },
    include: {
      event: true,
    },
  })
}

/**
 * Get a race with results and drivers
 * 
 * @param raceId - Race's unique identifier
 * @returns Race object with event, results, and drivers or null if not found
 */
export async function getRaceWithResults(
  raceId: string
): Promise<
  | (Race & {
      event: Event
      results: Array<
        RaceResult & {
          raceDriver: RaceDriver
        }
      >
    })
  | null
> {
  return prisma.race.findUnique({
    where: { id: raceId },
    include: {
      event: true,
      results: {
        include: {
          raceDriver: true,
        },
        orderBy: {
          positionFinal: "asc",
        },
      },
    },
  })
}

/**
 * Get a race with results, drivers, and laps
 * 
 * @param raceId - Race's unique identifier
 * @returns Race object with event, results, drivers, and laps or null if not found
 */
export async function getRaceWithLaps(
  raceId: string
): Promise<
  | (Race & {
      results: Array<
        RaceResult & {
          raceDriver: RaceDriver
          laps: Lap[]
        }
      >
    })
  | null
> {
  return prisma.race.findUnique({
    where: { id: raceId },
    include: {
      results: {
        include: {
          raceDriver: true,
          laps: {
            orderBy: {
              lapNumber: "asc",
            },
          },
        },
        orderBy: {
          positionFinal: "asc",
        },
      },
    },
  })
}

