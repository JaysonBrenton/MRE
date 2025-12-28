/**
 * @fileoverview Admin track management operations
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Functions for managing tracks in the admin console
 * 
 * @purpose Provides track management functionality for administrators,
 *          including viewing tracks, following/unfollowing, and viewing track events.
 * 
 * @relatedFiles
 * - src/core/tracks/repo.ts (track repository)
 * - src/core/admin/audit.ts (audit logging)
 */

import { prisma } from "@/lib/prisma"
import { getTrackById } from "@/core/tracks/repo"
import { createAuditLog } from "./audit"
import type { Track, Prisma } from "@prisma/client"

/**
 * Get all tracks with pagination and filtering
 * 
 * @param filters - Filter and pagination options
 * @returns Paginated tracks with event counts
 */
export async function getTracks(filters: {
  source?: string
  isFollowed?: boolean
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{
  tracks: (Track & { eventCount: number })[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const skip = (page - 1) * pageSize

  const where: Prisma.TrackWhereInput = {}
  
  if (filters.source) {
    where.source = filters.source
  }
  if (filters.isFollowed !== undefined) {
    where.isFollowed = filters.isFollowed
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  const [tracks, total] = await Promise.all([
    prisma.track.findMany({
      where,
      orderBy: { trackName: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { events: true },
        },
      },
    }),
    prisma.track.count({ where }),
  ])

  return {
    tracks: tracks.map((track) => ({
      ...track,
      eventCount: track._count.events,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Toggle follow status for a track
 * 
 * @param trackId - Track ID to update
 * @param isFollowed - New follow status
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 * @returns Updated track
 */
export async function setTrackFollowStatus(
  trackId: string,
  isFollowed: boolean,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<Track> {
  const track = await getTrackById(trackId)
  if (!track) {
    throw new Error("Track not found")
  }

  const updatedTrack = await prisma.track.update({
    where: { id: trackId },
    data: { isFollowed },
  })

  await createAuditLog({
    userId: adminUserId,
    action: isFollowed ? "track.follow" : "track.unfollow",
    resourceType: "track",
    resourceId: trackId,
    details: {
      trackName: track.trackName,
      previousIsFollowed: track.isFollowed,
      newIsFollowed: isFollowed,
    },
    ipAddress,
    userAgent,
  })

  return updatedTrack
}

