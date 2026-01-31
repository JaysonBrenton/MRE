/**
 * @fileoverview Audit log operations for admin console
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Functions for creating and retrieving audit log entries
 *
 * @purpose Provides audit logging functionality for tracking admin actions
 *          and system events. All admin actions should be logged for security
 *          and compliance.
 *
 * @relatedFiles
 * - prisma/schema.prisma (AuditLog model)
 * - src/lib/prisma.ts (Prisma client)
 */

import { prisma } from "@/lib/prisma"
import type { AuditLog, Prisma } from "@prisma/client"

/**
 * Create an audit log entry
 *
 * @param data - Audit log data
 * @returns Created audit log entry
 */
export async function createAuditLog(data: {
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  details?: Prisma.JsonValue
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<AuditLog> {
  return prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      details: data.details as Prisma.InputJsonValue,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  })
}

/**
 * Get audit logs with filtering and pagination
 *
 * @param filters - Filter options
 * @returns Paginated audit logs
 */
export async function getAuditLogs(filters: {
  userId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
}): Promise<{
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const skip = (page - 1) * pageSize

  const where: Prisma.AuditLogWhereInput = {}

  if (filters.userId) {
    where.userId = filters.userId
  }
  if (filters.action) {
    where.action = filters.action
  }
  if (filters.resourceType) {
    where.resourceType = filters.resourceType
  }
  if (filters.resourceId) {
    where.resourceId = filters.resourceId
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            driverName: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
