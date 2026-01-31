/**
 * @fileoverview Track repository - all Prisma queries for track domain
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Contains all database access functions for track operations
 *
 * @purpose This file centralizes all Prisma queries related to tracks, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/tracks/get-tracks.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { Track } from "@prisma/client"

export interface GetTracksFilters {
  followed?: boolean
  active?: boolean
}

/**
 * Get all tracks with optional filtering
 *
 * @param filters - Optional filters for followed and active status
 * @returns Array of Track objects
 */
export async function getTracks(filters: GetTracksFilters = {}): Promise<Track[]> {
  const where: {
    isFollowed?: boolean
    isActive?: boolean
  } = {}

  if (filters.followed !== undefined) {
    where.isFollowed = filters.followed
  }

  if (filters.active !== undefined) {
    where.isActive = filters.active
  }

  return prisma.track.findMany({
    where,
    orderBy: {
      trackName: "asc",
    },
  })
}

/**
 * Get a track by ID
 *
 * @param id - Track's unique identifier
 * @returns Track object or null if not found
 */
export async function getTrackById(id: string): Promise<Track | null> {
  return prisma.track.findUnique({
    where: { id },
  })
}
