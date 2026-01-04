/**
 * @fileoverview Core business logic for user profile data
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Core functions for retrieving comprehensive user profile information
 * 
 * @purpose Provides core domain logic for user profiles, following mobile-safe
 *          architecture guidelines. Aggregates user data, activity statistics, and
 *          driver linking information into a single profile object.
 * 
 * @relatedFiles
 * - src/core/users/repo.ts (database access)
 * - src/core/users/driver-links.ts (driver link status)
 * - src/app/api/v1/users/[userId]/profile/route.ts (API endpoint)
 */

import { findUserByIdWithPersona, getUserActivityStats } from "./repo"
import { getUserDriverLinks, type DriverLinkStatus } from "./driver-links"

export type UserProfile = {
  user: {
    id: string
    email: string
    driverName: string
    teamName: string | null
    isAdmin: boolean
    isTeamManager: boolean
    transponderNumber: string | null
    persona: {
      id: string
      type: string
      name: string
      description: string
    } | null
    createdAt: Date
    updatedAt: Date
  }
  activityStats: {
    eventCount: number
    raceCount: number
    bestLapTime: number | null
    bestAvgLapTime: number | null
    bestConsistency: number | null
  }
  driverLinks: DriverLinkStatus[]
}

/**
 * Get comprehensive user profile data
 * 
 * Aggregates user information, activity statistics, and driver linking status
 * into a single profile object for display in the user profile modal.
 * 
 * @param userId - User's unique identifier
 * @returns Complete user profile data
 * @throws Error if user not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  // Get user with persona
  const user = await findUserByIdWithPersona(userId)
  if (!user) {
    throw new Error("User not found")
  }

  // Get activity statistics
  const activityStats = await getUserActivityStats(userId)

  // Get driver links
  const driverLinks = await getUserDriverLinks(userId)

  // Format persona data
  const persona = user.persona
    ? {
        id: user.persona.id,
        type: user.persona.type,
        name: user.persona.name,
        description: user.persona.description,
      }
    : null

  return {
    user: {
      id: user.id,
      email: user.email,
      driverName: user.driverName,
      teamName: user.teamName,
      isAdmin: user.isAdmin,
      isTeamManager: user.isTeamManager,
      transponderNumber: user.transponderNumber,
      persona,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    activityStats,
    driverLinks,
  }
}

