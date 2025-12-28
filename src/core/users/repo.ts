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
 * @param email - User's email address
 * @returns User object or null if not found
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  // Normalize email to lowercase for case-insensitive lookup
  const normalizedEmail = normalizeEmail(email)
  return prisma.user.findUnique({
    where: { email: normalizedEmail }
  })
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

