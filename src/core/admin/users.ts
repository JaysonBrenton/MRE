/**
 * @fileoverview Admin user management operations
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Functions for managing users in the admin console
 * 
 * @purpose Provides user management functionality for administrators,
 *          including viewing, editing, deleting, and promoting/demoting users.
 * 
 * @relatedFiles
 * - src/core/users/repo.ts (user repository)
 * - src/core/admin/audit.ts (audit logging)
 */

import { prisma } from "@/lib/prisma"
import { findUserById } from "@/core/users/repo"
import { createAuditLog } from "./audit"
import type { User, Prisma } from "@prisma/client"

/**
 * Get all users with pagination and filtering
 * 
 * @param filters - Filter and pagination options
 * @returns Paginated users
 */
export async function getUsers(filters: {
  email?: string
  driverName?: string
  isAdmin?: boolean
  page?: number
  pageSize?: number
}): Promise<{
  users: Omit<User, "passwordHash">[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const skip = (page - 1) * pageSize

  const where: Prisma.UserWhereInput = {}
  
  if (filters.email) {
    where.email = { contains: filters.email, mode: "insensitive" }
  }
  if (filters.driverName) {
    where.driverName = { contains: filters.driverName, mode: "insensitive" }
  }
  if (filters.isAdmin !== undefined) {
    where.isAdmin = filters.isAdmin
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        driverName: true,
        normalizedName: true,
        transponderNumber: true,
        teamName: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Update user details
 * 
 * @param userId - User ID to update
 * @param data - Updated user data
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 * @returns Updated user
 */
export async function updateUser(
  userId: string,
  data: {
    driverName?: string
    teamName?: string | null
    email?: string
  },
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<Omit<User, "passwordHash">> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      transponderNumber: true,
      teamName: true,
      isAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await createAuditLog({
    userId: adminUserId,
    action: "user.update",
    resourceType: "user",
    resourceId: userId,
    details: {
      changes: data,
      previous: {
        driverName: user.driverName,
        teamName: user.teamName,
        email: user.email,
      },
    },
    ipAddress,
    userAgent,
  })

  return updatedUser
}

/**
 * Delete a user
 * 
 * @param userId - User ID to delete
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 */
export async function deleteUser(
  userId: string,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  await prisma.user.delete({
    where: { id: userId },
  })

  await createAuditLog({
    userId: adminUserId,
    action: "user.delete",
    resourceType: "user",
    resourceId: userId,
    details: {
      deletedUser: {
        email: user.email,
        driverName: user.driverName,
      },
    },
    ipAddress,
    userAgent,
  })
}

/**
 * Toggle admin status for a user
 * 
 * @param userId - User ID to update
 * @param isAdmin - New admin status
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 * @returns Updated user
 */
export async function setAdminStatus(
  userId: string,
  isAdmin: boolean,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<Omit<User, "passwordHash">> {
  const user = await findUserById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isAdmin },
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      transponderNumber: true,
      teamName: true,
      isAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await createAuditLog({
    userId: adminUserId,
    action: isAdmin ? "user.promote_admin" : "user.demote_admin",
    resourceType: "user",
    resourceId: userId,
    details: {
      previousIsAdmin: user.isAdmin,
      newIsAdmin: isAdmin,
    },
    ipAddress,
    userAgent,
  })

  return updatedUser
}

