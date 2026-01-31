/**
 * @fileoverview Race result repository - all Prisma queries for race result and lap domain
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Contains all database access functions for race result and lap operations
 *
 * @purpose This file centralizes all Prisma queries related to race results and laps, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/app/api/v1/race-results/[raceResultId]/laps/route.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { RaceResult, Lap } from "@prisma/client"

/**
 * Get a race result with ordered laps
 *
 * @param raceResultId - Race result's unique identifier
 * @returns Race result object with laps or null if not found
 */
export async function getRaceResultWithLaps(
  raceResultId: string
): Promise<(RaceResult & { laps: Lap[] }) | null> {
  return prisma.raceResult.findUnique({
    where: { id: raceResultId },
    include: {
      laps: {
        orderBy: {
          lapNumber: "asc",
        },
      },
    },
  })
}
