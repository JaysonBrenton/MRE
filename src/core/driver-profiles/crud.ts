/**
 * @fileoverview Core business logic for driver profile operations
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Core functions for driver profile CRUD operations
 * 
 * @purpose Provides core domain logic for driver profiles, following mobile-safe
 *          architecture guidelines. All business logic is separated from UI and
 *          API routes, ensuring it can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/core/driver-profiles/repo.ts (database access)
 * - src/app/api/v1/driver-profiles/route.ts (API endpoint)
 */

import {
  findDriverProfilesByUserId,
  findDriverProfileById,
  createDriverProfile,
  updateDriverProfile,
  deleteDriverProfile,
} from "./repo"
import type { Prisma } from "@prisma/client"

export type CreateDriverProfileInput = {
  userId: string
  name: string
  displayName: string
  transponderNumber?: string | null
  preferences?: Prisma.InputJsonValue
}

export type UpdateDriverProfileInput = {
  name?: string
  displayName?: string
  transponderNumber?: string | null
  preferences?: Prisma.InputJsonValue
}

/**
 * Get all driver profiles for a user
 * 
 * @param userId - User's unique identifier
 * @returns Array of driver profiles
 */
export async function getDriverProfilesByUserId(userId: string) {
  return findDriverProfilesByUserId(userId)
}

/**
 * Get a single driver profile by ID with ownership verification
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier
 * @returns Driver profile or null if not found or not owned by user
 */
export async function getDriverProfileById(id: string, userId: string) {
  return findDriverProfileById(id, userId)
}

/**
 * Create a new driver profile
 * 
 * @param userId - User's unique identifier
 * @param data - Driver profile data
 * @returns Created driver profile
 * @throws Error if validation fails
 */
export async function createDriverProfileForUser(
  userId: string,
  data: Omit<CreateDriverProfileInput, "userId">
) {
  // Validate required fields
  if (!data.name || !data.displayName) {
    throw new Error("Name and display name are required")
  }

  // Validate name length
  if (data.name.length > 100) {
    throw new Error("Name must be 100 characters or less")
  }

  // Validate display name length
  if (data.displayName.length > 100) {
    throw new Error("Display name must be 100 characters or less")
  }

  // Validate transponder number length if provided
  if (data.transponderNumber && data.transponderNumber.length > 50) {
    throw new Error("Transponder number must be 50 characters or less")
  }

  return createDriverProfile({
    user: {
      connect: { id: userId },
    },
    name: data.name,
    displayName: data.displayName,
    transponderNumber: data.transponderNumber || null,
    preferences: data.preferences || null,
  })
}

/**
 * Update an existing driver profile
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier
 * @param data - Driver profile update data
 * @returns Updated driver profile or null if not found or not owned by user
 * @throws Error if validation fails
 */
export async function updateDriverProfileForUser(
  id: string,
  userId: string,
  data: UpdateDriverProfileInput
) {
  // Validate name length if provided
  if (data.name !== undefined) {
    if (!data.name || data.name.length === 0) {
      throw new Error("Name cannot be empty")
    }
    if (data.name.length > 100) {
      throw new Error("Name must be 100 characters or less")
    }
  }

  // Validate display name length if provided
  if (data.displayName !== undefined) {
    if (data.displayName.length > 100) {
      throw new Error("Display name must be 100 characters or less")
    }
  }

  // Validate transponder number length if provided
  if (data.transponderNumber !== undefined && data.transponderNumber && data.transponderNumber.length > 50) {
    throw new Error("Transponder number must be 50 characters or less")
  }

  return updateDriverProfile(id, userId, data)
}

/**
 * Delete a driver profile
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier
 * @returns Deleted driver profile or null if not found or not owned by user
 */
export async function deleteDriverProfileForUser(id: string, userId: string) {
  return deleteDriverProfile(id, userId)
}
