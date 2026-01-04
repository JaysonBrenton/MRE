/**
 * @fileoverview User repository - all Prisma queries for user domain
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Contains all database access functions for user operations
 * 
 * @purpose This file centralizes all Prisma queries related to users, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/auth/register.ts (uses this repo)
 * - src/core/auth/login.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import { normalizeEmail } from "../common/email"
import { normalizeDriverName } from "./name-normalizer"
import type { User } from "@prisma/client"

/**
 * Find a user by email address
 * 
 * Emails are normalized to lowercase before querying to ensure case-insensitive
 * lookups, as email addresses should be treated as case-insensitive per RFC 5321.
 * 
 * Uses case-insensitive matching to handle legacy emails that may not be normalized.
 * 
 * @param email - User's email address
 * @returns User object or null if not found
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  // Normalize email to lowercase for case-insensitive lookup
  const normalizedEmail = normalizeEmail(email)
  
  // First try exact match with normalized email (for normalized emails)
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })
  
  // If not found and email might be mixed case in DB, try case-insensitive search
  // This handles the case where emails were stored before normalization was enforced
  if (!user) {
    // Use raw SQL query with Prisma's tagged template for safe parameterization
    // This ensures we can find users even if their email is stored with mixed case
    const result = await prisma.$queryRaw<Array<User>>`
      SELECT * FROM users WHERE LOWER(email) = LOWER(${normalizedEmail}) LIMIT 1
    `
    
    if (result && result.length > 0) {
      return result[0]
    }
  }
  
  return user
}

/**
 * Find a user by ID
 * 
 * @param id - User's unique identifier
 * @returns User object or null if not found
 */
export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id }
  })
}

/**
 * Get user by ID with only id and driverName fields
 * 
 * @param id - User's unique identifier
 * @returns User object with id and driverName, or null if not found
 */
export async function getUserById(id: string): Promise<{ id: string; driverName: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      driverName: true
    }
  })
  return user
}

/**
 * Create a new user account
 * 
 * @param data - User registration data
 * @returns Created user object (without password hash)
 */
export async function createUser(data: {
  email: string
  passwordHash: string
  driverName: string
  teamName: string | null
  isAdmin: boolean
  transponderNumber?: string | null
}): Promise<Omit<User, "passwordHash">> {
  // Normalize email to lowercase before storing
  // Emails should be case-insensitive per RFC 5321
  const normalizedEmail = normalizeEmail(data.email)
  // Compute normalized driver name for fuzzy matching
  const normalizedName = normalizeDriverName(data.driverName)
  
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      driverName: data.driverName,
      normalizedName,
      transponderNumber: data.transponderNumber || null,
      teamName: data.teamName,
      isAdmin: data.isAdmin,
    },
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      transponderNumber: true,
      teamName: true,
      isAdmin: true,
      isTeamManager: true,
      personaId: true,
      createdAt: true,
      updatedAt: true,
    }
  })

  return user
}

/**
 * Find a user by ID with persona relation
 * 
 * @param id - User's unique identifier
 * @returns User object with persona or null if not found
 */
export async function findUserByIdWithPersona(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      persona: true,
    },
  })
}

/**
 * Get user activity statistics
 * 
 * Aggregates statistics about user's participation in events, races, and performance metrics.
 * 
 * @param userId - User's unique identifier
 * @returns Activity statistics object
 */
export async function getUserActivityStats(userId: string) {
  // Get distinct event count via EventDriverLink
  const distinctEvents = await prisma.eventDriverLink.findMany({
    where: { userId },
    select: {
      eventId: true,
    },
    distinct: ["eventId"],
  })
  const eventCount = distinctEvents.length

  // Get race count via linked drivers
  // First get all driver IDs linked to this user
  const userDriverLinks = await prisma.userDriverLink.findMany({
    where: {
      userId,
      status: {
        in: ["confirmed", "suggested"],
      },
    },
    select: {
      driverId: true,
    },
  })

  const driverIds = userDriverLinks.map((link) => link.driverId)

  // Count distinct races where these drivers participated
  const raceCount = driverIds.length > 0
    ? (
        await prisma.raceDriver.findMany({
          where: {
            driverId: { in: driverIds },
          },
          select: {
            raceId: true,
          },
          distinct: ["raceId"],
        })
      ).length
    : 0

  // Get best lap time, best average lap time, and best consistency
  // via RaceResult through linked drivers
  let bestLapTime: number | null = null
  let bestAvgLapTime: number | null = null
  let bestConsistency: number | null = null

  if (driverIds.length > 0) {
    // Get race driver IDs for linked drivers
    const raceDrivers = await prisma.raceDriver.findMany({
      where: {
        driverId: { in: driverIds },
      },
      select: {
        id: true,
      },
    })

    const raceDriverIds = raceDrivers.map((rd) => rd.id)

    // Get all race results for these race drivers
    const raceResults = await prisma.raceResult.findMany({
      where: {
        raceDriverId: { in: raceDriverIds },
      },
      select: {
        fastLapTime: true,
        avgLapTime: true,
        consistency: true,
      },
    })

    // Calculate bests
    for (const result of raceResults) {
      if (result.fastLapTime !== null) {
        if (bestLapTime === null || result.fastLapTime < bestLapTime) {
          bestLapTime = result.fastLapTime
        }
      }
      if (result.avgLapTime !== null) {
        if (bestAvgLapTime === null || result.avgLapTime < bestAvgLapTime) {
          bestAvgLapTime = result.avgLapTime
        }
      }
      if (result.consistency !== null) {
        if (bestConsistency === null || result.consistency > bestConsistency) {
          bestConsistency = result.consistency
        }
      }
    }
  }

  return {
    eventCount,
    raceCount,
    bestLapTime,
    bestAvgLapTime,
    bestConsistency,
  }
}

