/**
 * @fileoverview Driver repository - all Prisma queries for driver domain
 * 
 * @created 2025-12-24
 * @creator Jayson Brenton
 * @lastModified 2025-12-24
 * 
 * @description Contains all database access functions for driver operations
 * 
 * @purpose This file centralizes all Prisma queries related to drivers, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/app/api/v1/drivers/[driverId]/route.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { Driver, EventEntry, TransponderOverride, Event, Race } from "@prisma/client"

export interface DriverWithEventEntries {
  id: string
  displayName: string
  sourceDriverId: string
  transponderNumber: string | null
  eventEntries: Array<{
    eventId: string
    eventName: string
    className: string
    transponderNumber: string | null
    carNumber: string | null
    override?: {
      transponderNumber: string
      effectiveFromRaceId: string | null
      effectiveFromRaceLabel: string | null
      createdAt: Date
    }
  }>
}

/**
 * Get a driver by ID with basic info
 * 
 * @param driverId - Driver's unique identifier
 * @returns Driver object or null if not found
 */
export async function getDriverById(driverId: string): Promise<Driver | null> {
  return prisma.driver.findUnique({
    where: { id: driverId },
  })
}

/**
 * Get a driver with EventEntry records and TransponderOverrides
 * 
 * @param driverId - Driver's unique identifier
 * @param eventId - Optional event ID to filter entries and overrides
 * @returns Driver with EventEntry records and overrides, or null if not found
 */
export async function getDriverWithEventEntries(
  driverId: string,
  eventId?: string
): Promise<DriverWithEventEntries | null> {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      eventEntries: {
        where: eventId ? { eventId } : undefined,
        include: {
          event: {
            select: {
              id: true,
              eventName: true,
            },
          },
        },
        orderBy: {
          className: "asc",
        },
      },
      transponderOverrides: eventId
        ? {
            where: { eventId },
            include: {
              effectiveFromRace: {
                select: {
                  id: true,
                  raceLabel: true,
                  raceOrder: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          }
        : {
            include: {
              effectiveFromRace: {
                select: {
                  id: true,
                  raceLabel: true,
                  raceOrder: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
    },
  })

  if (!driver) {
    return null
  }

  // Build override map: eventId -> most recent override
  // Note: Overrides are per driver/event, not per class, so we use eventId as key
  const overrideMap = new Map<string, TransponderOverride & { effectiveFromRace: Race | null }>()
  
  for (const override of driver.transponderOverrides) {
    // Key: eventId (override applies to all classes in the event)
    const key = override.eventId
    
    // Only keep most recent override per event (already sorted by createdAt DESC)
    if (!overrideMap.has(key)) {
      overrideMap.set(key, override as TransponderOverride & { effectiveFromRace: Race | null })
    }
  }

  // Build result with overrides merged into event entries
  const eventEntries = driver.eventEntries.map((entry) => {
    // Override applies to all classes in the event, so use eventId as key
    const override = overrideMap.get(entry.eventId)

    return {
      eventId: entry.eventId,
      eventName: entry.event.eventName,
      className: entry.className,
      transponderNumber: entry.transponderNumber,
      carNumber: entry.carNumber,
      override: override
        ? {
            transponderNumber: override.transponderNumber,
            effectiveFromRaceId: override.effectiveFromRaceId,
            effectiveFromRaceLabel: override.effectiveFromRace
              ? `${override.effectiveFromRace.raceLabel} (Race ${override.effectiveFromRace.raceOrder || "?"})`
              : "All races",
            createdAt: override.createdAt,
          }
        : undefined,
    }
  })

  return {
    id: driver.id,
    displayName: driver.displayName,
    sourceDriverId: driver.sourceDriverId,
    transponderNumber: driver.transponderNumber,
    eventEntries,
  }
}

/**
 * Get effective transponder number for a specific race
 * 
 * Priority:
 * 1. TransponderOverride (if exists and applies to race)
 * 2. EventEntry.transponderNumber (original from entry list)
 * 3. Driver.transponderNumber (fallback default)
 * 
 * @param driverId - Driver's unique identifier
 * @param eventId - Event ID
 * @param raceId - Race ID to check override applicability
 * @param className - Class name to match EventEntry
 * @returns Effective transponder number and source, or null if not found
 */
export async function getTransponderForRace(
  driverId: string,
  eventId: string,
  raceId: string,
  className: string
): Promise<{ transponderNumber: string | null; source: "entry_list" | "override" | "driver" | null }> {
  // Get race order for comparison
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { raceOrder: true },
  })

  if (!race || race.raceOrder === null) {
    // Can't determine race order, fall back to entry list
    const entry = await prisma.eventEntry.findFirst({
      where: {
        driverId,
        eventId,
        className,
      },
      select: {
        transponderNumber: true,
      },
    })

    return {
      transponderNumber: entry?.transponderNumber || null,
      source: entry?.transponderNumber ? "entry_list" : null,
    }
  }

  // Get EventEntry for this driver/event/class
  const entry = await prisma.eventEntry.findFirst({
    where: {
      driverId,
      eventId,
      className,
    },
    select: {
      transponderNumber: true,
    },
  })

  // Get all races in the event to compare race orders
  const allRaces = await prisma.race.findMany({
    where: { eventId },
    select: {
      id: true,
      raceOrder: true,
    },
    orderBy: {
      raceOrder: "asc",
    },
  })

  // Get all overrides for this driver/event (we'll filter by race order in code)
  const overrides = await prisma.transponderOverride.findMany({
    where: {
      driverId,
      eventId,
    },
    include: {
      effectiveFromRace: {
        select: {
          id: true,
          raceOrder: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc", // Most recent first
    },
  })

  // Check if any override applies to this race
  // Override applies if:
  // - effectiveFromRaceId is NULL (all races from first race onwards)
  // - effectiveFromRaceId matches raceId (exact match - applies from this race)
  // - effectiveFromRace.raceOrder <= race.raceOrder (applies from that race onwards)
  let applicableOverride = null
  for (const override of overrides) {
    if (override.effectiveFromRaceId === null) {
      // Applies to all races from first race onwards
      applicableOverride = override
      break
    } else if (override.effectiveFromRaceId === raceId) {
      // Exact match - applies from this race onwards
      applicableOverride = override
      break
    } else if (override.effectiveFromRace && race.raceOrder !== null) {
      // Check if override's race order <= current race order (applies from that race onwards)
      if (override.effectiveFromRace.raceOrder !== null && override.effectiveFromRace.raceOrder <= race.raceOrder) {
        applicableOverride = override
        break
      }
    }
  }

  if (applicableOverride) {
    return {
      transponderNumber: applicableOverride.transponderNumber,
      source: "override",
    }
  }

  if (entry?.transponderNumber) {
    return {
      transponderNumber: entry.transponderNumber,
      source: "entry_list",
    }
  }

  // Fallback to driver-level transponder
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      transponderNumber: true,
    },
  })

  return {
    transponderNumber: driver?.transponderNumber || null,
    source: driver?.transponderNumber ? "driver" : null,
  }
}

