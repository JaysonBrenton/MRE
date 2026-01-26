/**
 * @fileoverview Track map repository - all Prisma queries for track map domain
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Contains all database access functions for track map operations
 * 
 * @purpose This file centralizes all Prisma queries related to track maps, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/track-maps/types.ts (type definitions)
 * - src/core/track-maps/validation.ts (data validation)
 */

import { prisma } from "@/lib/prisma"
import type { TrackMap, Prisma } from "@prisma/client"
import type {
  CreateTrackMapParams,
  UpdateTrackMapParams,
  TrackMapWithRelations,
  TrackMapData,
} from "./types"
import { validateTrackMapData } from "./validation"
import { randomBytes } from "crypto"

/**
 * Find all track maps for a user, optionally filtered by track
 * 
 * @param userId - User's unique identifier
 * @param trackId - Optional track ID to filter by
 * @returns Array of track maps with relations
 */
export async function findTrackMapsByUserId(
  userId: string,
  trackId?: string
): Promise<TrackMapWithRelations[]> {
  const where: Prisma.TrackMapWhereInput = {
    userId,
    ...(trackId ? { trackId } : {}),
  }

  const maps = await prisma.trackMap.findMany({
    where,
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return maps.map((map) => ({
    ...map,
    mapData: map.mapData as TrackMapData,
  }))
}

/**
 * Find public track maps, optionally filtered by track
 * 
 * @param trackId - Optional track ID to filter by
 * @returns Array of public track maps with relations
 */
export async function findPublicTrackMaps(
  trackId?: string
): Promise<TrackMapWithRelations[]> {
  const where: Prisma.TrackMapWhereInput = {
    isPublic: true,
    ...(trackId ? { trackId } : {}),
  }

  const maps = await prisma.trackMap.findMany({
    where,
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return maps.map((map) => ({
    ...map,
    mapData: map.mapData as TrackMapData,
  }))
}

/**
 * Find a track map by ID with ownership verification
 * 
 * @param id - Track map unique identifier
 * @param userId - User's unique identifier for ownership check (optional for public maps)
 * @returns Track map with relations or null if not found
 */
export async function findTrackMapById(
  id: string,
  userId?: string
): Promise<TrackMapWithRelations | null> {
  const map = await prisma.trackMap.findUnique({
    where: { id },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
  })

  if (!map) {
    return null
  }

  // If userId provided, verify ownership or public access
  if (userId && map.userId !== userId && !map.isPublic) {
    return null
  }

  return {
    ...map,
    mapData: map.mapData as TrackMapData,
  }
}

/**
 * Find a track map by share token
 * 
 * @param shareToken - Share token
 * @returns Track map with relations or null if not found
 */
export async function findTrackMapByShareToken(
  shareToken: string
): Promise<TrackMapWithRelations | null> {
  const map = await prisma.trackMap.findUnique({
    where: { shareToken },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
  })

  if (!map) {
    return null
  }

  return {
    ...map,
    mapData: map.mapData as TrackMapData,
  }
}

/**
 * Create a new track map
 * 
 * @param params - Track map creation parameters
 * @returns Created track map with relations
 */
export async function createTrackMap(
  params: CreateTrackMapParams
): Promise<TrackMapWithRelations> {
  // Validate map data
  if (!validateTrackMapData(params.mapData)) {
    throw new Error("Invalid track map data")
  }

  const map = await prisma.trackMap.create({
    data: {
      userId: params.userId,
      trackId: params.trackId,
      name: params.name,
      description: params.description,
      mapData: params.mapData as Prisma.JsonValue,
      isPublic: params.isPublic ?? false,
    },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
  })

  return {
    ...map,
    mapData: map.mapData as TrackMapData,
  }
}

/**
 * Update an existing track map
 * 
 * @param id - Track map unique identifier
 * @param userId - User's unique identifier for ownership check
 * @param params - Track map update parameters
 * @returns Updated track map with relations or null if not found or not owned by user
 */
export async function updateTrackMap(
  id: string,
  userId: string,
  params: UpdateTrackMapParams
): Promise<TrackMapWithRelations | null> {
  // First verify ownership
  const existing = await prisma.trackMap.findFirst({
    where: {
      id,
      userId,
    },
  })

  if (!existing) {
    return null
  }

  // Validate map data if provided
  if (params.mapData && !validateTrackMapData(params.mapData)) {
    throw new Error("Invalid track map data")
  }

  const updateData: Prisma.TrackMapUpdateInput = {}
  if (params.name !== undefined) {
    updateData.name = params.name
  }
  if (params.description !== undefined) {
    updateData.description = params.description
  }
  if (params.mapData !== undefined) {
    updateData.mapData = params.mapData as Prisma.JsonValue
  }
  if (params.isPublic !== undefined) {
    updateData.isPublic = params.isPublic
  }

  const map = await prisma.trackMap.update({
    where: { id },
    data: updateData,
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
  })

  return {
    ...map,
    mapData: map.mapData as TrackMapData,
  }
}

/**
 * Delete a track map
 * 
 * @param id - Track map unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Deleted track map or null if not found or not owned by user
 */
export async function deleteTrackMap(
  id: string,
  userId: string
): Promise<TrackMap | null> {
  // First verify ownership
  const existing = await prisma.trackMap.findFirst({
    where: {
      id,
      userId,
    },
  })

  if (!existing) {
    return null
  }

  return prisma.trackMap.delete({
    where: { id },
  })
}

/**
 * Generate a share token for a track map
 * 
 * @param id - Track map unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Updated track map with share token or null if not found or not owned by user
 */
export async function generateShareToken(
  id: string,
  userId: string
): Promise<TrackMapWithRelations | null> {
  // First verify ownership
  const existing = await prisma.trackMap.findFirst({
    where: {
      id,
      userId,
    },
  })

  if (!existing) {
    return null
  }

  // Generate a secure random token
  const shareToken = randomBytes(32).toString("base64url")

  const map = await prisma.trackMap.update({
    where: { id },
    data: { shareToken },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
  })

  return {
    ...map,
    mapData: map.mapData as TrackMapData,
  }
}

