/**
 * @fileoverview Driver profile repository - all Prisma queries for driver profile domain
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Contains all database access functions for driver profile operations
 * 
 * @purpose This file centralizes all Prisma queries related to driver profiles, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/driver-profiles/crud.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { DriverProfile, Prisma } from "@prisma/client"

/**
 * Find all driver profiles for a user
 * 
 * @param userId - User's unique identifier
 * @returns Array of driver profiles
 */
export async function findDriverProfilesByUserId(userId: string): Promise<DriverProfile[]> {
  return prisma.driverProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Find a driver profile by ID with ownership verification
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Driver profile or null if not found or not owned by user
 */
export async function findDriverProfileById(
  id: string,
  userId: string
): Promise<DriverProfile | null> {
  return prisma.driverProfile.findFirst({
    where: {
      id,
      userId,
    },
  })
}

/**
 * Create a new driver profile
 * 
 * @param data - Driver profile data
 * @returns Created driver profile
 */
export async function createDriverProfile(
  data: Prisma.DriverProfileCreateInput
): Promise<DriverProfile> {
  return prisma.driverProfile.create({
    data,
  })
}

/**
 * Update an existing driver profile
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @param data - Driver profile update data
 * @returns Updated driver profile or null if not found or not owned by user
 */
export async function updateDriverProfile(
  id: string,
  userId: string,
  data: Prisma.DriverProfileUpdateInput
): Promise<DriverProfile | null> {
  // First verify ownership
  const existing = await findDriverProfileById(id, userId)
  if (!existing) {
    return null
  }

  return prisma.driverProfile.update({
    where: { id },
    data,
  })
}

/**
 * Delete a driver profile
 * 
 * @param id - Driver profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Deleted driver profile or null if not found or not owned by user
 */
export async function deleteDriverProfile(
  id: string,
  userId: string
): Promise<DriverProfile | null> {
  // First verify ownership
  const existing = await findDriverProfileById(id, userId)
  if (!existing) {
    return null
  }

  return prisma.driverProfile.delete({
    where: { id },
  })
}
