/**
 * @fileoverview Car profile repository - all Prisma queries for car profile domain
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Contains all database access functions for car profile operations
 * 
 * @purpose This file centralizes all Prisma queries related to car profiles, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/car-profiles/crud.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { CarProfile, Prisma } from "@prisma/client"

/**
 * Find all car profiles for a user
 * 
 * @param userId - User's unique identifier
 * @returns Array of car profiles
 */
export async function findCarProfilesByUserId(userId: string): Promise<CarProfile[]> {
  return prisma.carProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Find a car profile by ID with ownership verification
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Car profile or null if not found or not owned by user
 */
export async function findCarProfileById(
  id: string,
  userId: string
): Promise<CarProfile | null> {
  return prisma.carProfile.findFirst({
    where: {
      id,
      userId,
    },
  })
}

/**
 * Create a new car profile
 * 
 * @param data - Car profile data
 * @returns Created car profile
 */
export async function createCarProfile(
  data: Prisma.CarProfileCreateInput
): Promise<CarProfile> {
  return prisma.carProfile.create({
    data,
  })
}

/**
 * Update an existing car profile
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @param data - Car profile update data
 * @returns Updated car profile or null if not found or not owned by user
 */
export async function updateCarProfile(
  id: string,
  userId: string,
  data: Prisma.CarProfileUpdateInput
): Promise<CarProfile | null> {
  // First verify ownership
  const existing = await findCarProfileById(id, userId)
  if (!existing) {
    return null
  }

  return prisma.carProfile.update({
    where: { id },
    data,
  })
}

/**
 * Delete a car profile
 * 
 * @param id - Car profile unique identifier
 * @param userId - User's unique identifier for ownership check
 * @returns Deleted car profile or null if not found or not owned by user
 */
export async function deleteCarProfile(
  id: string,
  userId: string
): Promise<CarProfile | null> {
  // First verify ownership
  const existing = await findCarProfileById(id, userId)
  if (!existing) {
    return null
  }

  return prisma.carProfile.delete({
    where: { id },
  })
}
