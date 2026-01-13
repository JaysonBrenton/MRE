/**
 * @fileoverview Core business logic for car profile operations
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Core functions for car profile CRUD operations
 * 
 * @purpose Provides core domain logic for car profiles, following mobile-safe
 *          architecture guidelines. All business logic is separated from UI and
 *          API routes, ensuring it can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/core/car-profiles/repo.ts (database access)
 * - src/app/api/v1/car-profiles/route.ts (API endpoint)
 */

import {
  findCarProfilesByUserId,
  findCarProfileById,
  createCarProfile,
  updateCarProfile,
  deleteCarProfile,
} from "./repo"
import type { Prisma } from "@prisma/client"

export type CreateCarProfileInput = {
  userId: string
  name: string
  carType: string
  vehicleType: string
  setupInfo?: Prisma.InputJsonValue
}

export type UpdateCarProfileInput = {
  name?: string
  carType?: string
  vehicleType?: string
  setupInfo?: Prisma.InputJsonValue
}

/**
 * Get all car profiles for a user
 * 
 * @param userId - User's unique identifier
 * @returns Array of car profiles
 */
export async function getCarProfilesByUserId(userId: string) {
  return findCarProfilesByUserId(userId)
}

/**
 * Get a single car profile by ID with ownership verification
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier
 * @returns Car profile or null if not found or not owned by user
 */
export async function getCarProfileById(id: string, userId: string) {
  return findCarProfileById(id, userId)
}

/**
 * Create a new car profile
 * 
 * @param userId - User's unique identifier
 * @param data - Car profile data
 * @returns Created car profile
 * @throws Error if validation fails
 */
export async function createCarProfileForUser(
  userId: string,
  data: Omit<CreateCarProfileInput, "userId">
) {
  // Validate required fields
  if (!data.name || !data.carType || !data.vehicleType) {
    throw new Error("Name, car type, and vehicle type are required")
  }

  // Validate name length
  if (data.name.length > 100) {
    throw new Error("Name must be 100 characters or less")
  }

  // Validate car type length
  if (data.carType.length > 50) {
    throw new Error("Car type must be 50 characters or less")
  }

  // Validate vehicle type length
  if (data.vehicleType.length > 50) {
    throw new Error("Vehicle type must be 50 characters or less")
  }

  return createCarProfile({
    user: {
      connect: { id: userId },
    },
    name: data.name,
    carType: data.carType,
    vehicleType: data.vehicleType,
    setupInfo: data.setupInfo || null,
  })
}

/**
 * Update an existing car profile
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier
 * @param data - Car profile update data
 * @returns Updated car profile or null if not found or not owned by user
 * @throws Error if validation fails
 */
export async function updateCarProfileForUser(
  id: string,
  userId: string,
  data: UpdateCarProfileInput
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

  // Validate car type length if provided
  if (data.carType !== undefined) {
    if (data.carType.length > 50) {
      throw new Error("Car type must be 50 characters or less")
    }
  }

  // Validate vehicle type length if provided
  if (data.vehicleType !== undefined) {
    if (data.vehicleType.length > 50) {
      throw new Error("Vehicle type must be 50 characters or less")
    }
  }

  return updateCarProfile(id, userId, data)
}

/**
 * Delete a car profile
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier
 * @returns Deleted car profile or null if not found or not owned by user
 */
export async function deleteCarProfileForUser(id: string, userId: string) {
  return deleteCarProfile(id, userId)
}
