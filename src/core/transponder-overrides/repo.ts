/**
 * @fileoverview Transponder override repository - all Prisma queries for transponder override domain
 *
 * @created 2025-12-24
 * @creator Jayson Brenton
 * @lastModified 2025-12-24
 *
 * @description Contains all database access functions for transponder override operations
 *
 * @purpose This file centralizes all Prisma queries related to transponder overrides, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/app/api/v1/transponder-overrides/route.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { TransponderOverride, Race } from "@prisma/client"

export interface CreateTransponderOverrideParams {
  eventId: string
  driverId: string
  effectiveFromRaceId?: string | null
  transponderNumber: string
  createdBy?: string | null
}

export interface UpdateTransponderOverrideParams {
  effectiveFromRaceId?: string | null
  transponderNumber?: string
}

/**
 * Validate transponder number format
 *
 * @param transponderNumber - Transponder number to validate
 * @returns true if valid, false otherwise
 */
function validateTransponderFormat(transponderNumber: string): boolean {
  // Format: numeric, reasonable length (1-20 characters)
  return /^\d{1,20}$/.test(transponderNumber)
}

/**
 * Validate transponder uniqueness for affected races
 *
 * @param transponderNumber - Transponder number to check
 * @param eventId - Event ID
 * @param effectiveFromRaceId - Race ID from which override applies (null = all races)
 * @param excludeDriverId - Driver ID to exclude from check (for updates)
 * @returns true if unique, false if duplicate found
 */
async function validateTransponderUniqueness(
  transponderNumber: string,
  eventId: string,
  effectiveFromRaceId: string | null,
  excludeDriverId?: string
): Promise<boolean> {
  // Get all races in the event
  const races = await prisma.race.findMany({
    where: { eventId },
    select: {
      id: true,
      raceOrder: true,
    },
    orderBy: {
      raceOrder: "asc",
    },
  })

  // Determine which races are affected by this override
  let affectedRaceIds: string[] = []

  if (effectiveFromRaceId === null) {
    // Applies to all races
    affectedRaceIds = races.map((r) => r.id)
  } else {
    // Find the race order for the effective race
    const effectiveRace = races.find((r) => r.id === effectiveFromRaceId)
    if (effectiveRace && effectiveRace.raceOrder !== null) {
      // Include all races from effective race onwards
      affectedRaceIds = races
        .filter(
          (r) =>
            r.raceOrder !== null &&
            effectiveRace.raceOrder !== null &&
            r.raceOrder >= effectiveRace.raceOrder
        )
        .map((r) => r.id)
    } else {
      // Fallback: just the specific race
      affectedRaceIds = [effectiveFromRaceId]
    }
  }

  if (affectedRaceIds.length === 0) {
    return true // No races affected, consider it valid
  }

  // Check for other drivers with same transponder in affected races
  // Check EventEntry (original transponders)
  const conflictingEntries = await prisma.eventEntry.findFirst({
    where: {
      eventId,
      transponderNumber,
      driverId: excludeDriverId ? { not: excludeDriverId } : undefined,
    },
  })

  if (conflictingEntries) {
    return false // Duplicate found in entry list
  }

  // Check TransponderOverride (other overrides)
  // Get all overrides for this transponder in this event
  const conflictingOverrides = await prisma.transponderOverride.findMany({
    where: {
      eventId,
      transponderNumber,
      driverId: excludeDriverId ? { not: excludeDriverId } : undefined,
    },
    include: {
      effectiveFromRace: {
        select: {
          raceOrder: true,
        },
      },
    },
  })

  // Check if any conflicting override applies to the same races
  for (const override of conflictingOverrides) {
    let overrideAffectedRaceIds: string[] = []

    if (override.effectiveFromRaceId === null) {
      // Override applies to all races
      overrideAffectedRaceIds = races.map((r) => r.id)
    } else {
      const overrideEffectiveRace = races.find((r) => r.id === override.effectiveFromRaceId)
      if (overrideEffectiveRace && overrideEffectiveRace.raceOrder !== null) {
        const minOrder = overrideEffectiveRace.raceOrder
        overrideAffectedRaceIds = races
          .filter((r) => r.raceOrder !== null && r.raceOrder >= minOrder)
          .map((r) => r.id)
      } else {
        overrideAffectedRaceIds = override.effectiveFromRaceId ? [override.effectiveFromRaceId] : []
      }
    }

    // Check for overlap
    const hasOverlap = affectedRaceIds.some((raceId) => overrideAffectedRaceIds.includes(raceId))
    if (hasOverlap) {
      return false // Duplicate found in overlapping races
    }
  }

  return true // No conflicts found
}

/**
 * Create a new transponder override
 *
 * @param params - Override parameters
 * @returns Created override
 * @throws Error if validation fails
 */
export async function createTransponderOverride(
  params: CreateTransponderOverrideParams
): Promise<TransponderOverride> {
  const { eventId, driverId, effectiveFromRaceId, transponderNumber, createdBy } = params

  // Validate format
  if (!validateTransponderFormat(transponderNumber)) {
    throw new Error("Invalid transponder number format. Must be numeric and 1-20 characters.")
  }

  // Validate uniqueness
  const isUnique = await validateTransponderUniqueness(
    transponderNumber,
    eventId,
    effectiveFromRaceId || null,
    driverId
  )

  if (!isUnique) {
    throw new Error("Transponder number already in use by another driver in affected races.")
  }

  // Create override
  return prisma.transponderOverride.create({
    data: {
      eventId,
      driverId,
      effectiveFromRaceId: effectiveFromRaceId || null,
      transponderNumber,
      createdBy: createdBy || null,
    },
  })
}

/**
 * Get transponder override for driver/event/race
 *
 * @param driverId - Driver ID
 * @param eventId - Event ID
 * @param raceId - Optional race ID to get override for specific race
 * @returns Override or null if not found
 */
export async function getTransponderOverride(
  driverId: string,
  eventId: string,
  raceId?: string
): Promise<TransponderOverride | null> {
  if (raceId) {
    // Get override for specific race (most recent that applies)
    const overrides = await prisma.transponderOverride.findMany({
      where: {
        driverId,
        eventId,
        OR: [{ effectiveFromRaceId: null }, { effectiveFromRaceId: raceId }],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    })

    return overrides[0] || null
  }

  // Get most recent override for driver/event
  return prisma.transponderOverride.findFirst({
    where: {
      driverId,
      eventId,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

/**
 * List transponder overrides
 *
 * @param eventId - Optional event ID filter
 * @param driverId - Optional driver ID filter
 * @returns List of overrides
 */
export async function listTransponderOverrides(
  eventId?: string,
  driverId?: string
): Promise<Array<TransponderOverride & { effectiveFromRace: Race | null }>> {
  return prisma.transponderOverride.findMany({
    where: {
      eventId: eventId ? { equals: eventId } : undefined,
      driverId: driverId ? { equals: driverId } : undefined,
    },
    include: {
      effectiveFromRace: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

/**
 * Update transponder override
 *
 * @param overrideId - Override ID
 * @param params - Update parameters
 * @returns Updated override
 * @throws Error if validation fails
 */
export async function updateTransponderOverride(
  overrideId: string,
  params: UpdateTransponderOverrideParams
): Promise<TransponderOverride> {
  // Get existing override to validate uniqueness
  const existing = await prisma.transponderOverride.findUnique({
    where: { id: overrideId },
  })

  if (!existing) {
    throw new Error("Transponder override not found")
  }

  const { effectiveFromRaceId, transponderNumber } = params

  // Validate format if transponder number is being updated
  if (transponderNumber !== undefined && !validateTransponderFormat(transponderNumber)) {
    throw new Error("Invalid transponder number format. Must be numeric and 1-20 characters.")
  }

  // Validate uniqueness if transponder or scope is being updated
  if (transponderNumber !== undefined || effectiveFromRaceId !== undefined) {
    const finalTransponderNumber = transponderNumber ?? existing.transponderNumber
    const finalEffectiveFromRaceId =
      effectiveFromRaceId !== undefined ? effectiveFromRaceId : existing.effectiveFromRaceId

    const isUnique = await validateTransponderUniqueness(
      finalTransponderNumber,
      existing.eventId,
      finalEffectiveFromRaceId || null,
      existing.driverId
    )

    if (!isUnique) {
      throw new Error("Transponder number already in use by another driver in affected races.")
    }
  }

  // Update override
  return prisma.transponderOverride.update({
    where: { id: overrideId },
    data: {
      effectiveFromRaceId: effectiveFromRaceId !== undefined ? effectiveFromRaceId : undefined,
      transponderNumber: transponderNumber !== undefined ? transponderNumber : undefined,
    },
  })
}

/**
 * Delete transponder override
 *
 * @param overrideId - Override ID
 * @returns Deleted override
 */
export async function deleteTransponderOverride(overrideId: string): Promise<TransponderOverride> {
  return prisma.transponderOverride.delete({
    where: { id: overrideId },
  })
}

/**
 * Validate transponder uniqueness (public function for API use)
 *
 * @param transponderNumber - Transponder number to check
 * @param eventId - Event ID
 * @param effectiveFromRaceId - Race ID from which override applies (null = all races)
 * @param excludeDriverId - Optional driver ID to exclude from check
 * @returns true if unique, false if duplicate found
 */
export async function validateTransponderUniquenessPublic(
  transponderNumber: string,
  eventId: string,
  effectiveFromRaceId: string | null,
  excludeDriverId?: string
): Promise<boolean> {
  return validateTransponderUniqueness(
    transponderNumber,
    eventId,
    effectiveFromRaceId,
    excludeDriverId
  )
}
