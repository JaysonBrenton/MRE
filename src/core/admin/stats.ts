/**
 * @fileoverview System statistics for admin console
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Functions for calculating system statistics
 * 
 * @purpose Provides statistics about the system for the admin dashboard,
 *          including user counts, event counts, track counts, and database metrics.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 */

import { prisma } from "@/lib/prisma"

/**
 * Get system statistics
 * 
 * @returns System statistics object
 */
export async function getSystemStats(): Promise<{
  users: {
    total: number
    admins: number
    regular: number
  }
  events: {
    total: number
    ingested: number
    notIngested: number
  }
  tracks: {
    total: number
    followed: number
    active: number
  }
  database: {
    size: string | null
    connectionPool: {
      active: number
      idle: number
    }
  }
}> {
  const [
    userCounts,
    eventCounts,
    trackCounts,
  ] = await Promise.all([
    // User statistics
    prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.user.count({ where: { isAdmin: false } }),
    ]),
    // Event statistics
    prisma.$transaction([
      prisma.event.count(),
      prisma.event.count({ where: { ingestDepth: "laps_full" } }),
      prisma.event.count({ where: { ingestDepth: "none" } }),
    ]),
    // Track statistics
    prisma.$transaction([
      prisma.track.count(),
      prisma.track.count({ where: { isFollowed: true } }),
      prisma.track.count({ where: { isActive: true } }),
    ]),
  ])

  // Get database size (PostgreSQL specific)
  let dbSize: string | null = null
  try {
    const result = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `
    dbSize = result[0]?.size ?? null
  } catch (error) {
    // Ignore errors getting database size
    console.error("Failed to get database size:", error)
  }

  return {
    users: {
      total: userCounts[0],
      admins: userCounts[1],
      regular: userCounts[2],
    },
    events: {
      total: eventCounts[0],
      ingested: eventCounts[1],
      notIngested: eventCounts[2],
    },
    tracks: {
      total: trackCounts[0],
      followed: trackCounts[1],
      active: trackCounts[2],
    },
    database: {
      size: dbSize,
      connectionPool: {
        // Prisma doesn't expose connection pool stats directly
        // These would need to be obtained from the connection pool if available
        active: 0,
        idle: 0,
      },
    },
  }
}

