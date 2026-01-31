/**
 * @fileoverview Log viewing operations for admin console
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 *
 * @description Functions for retrieving and streaming logs
 *
 * @purpose Provides log viewing functionality for administrators,
 *          including paginated log retrieval and log source management.
 *          Logs are retrieved from the database where they are persisted
 *          by the structured logger.
 *
 * @relatedFiles
 * - src/lib/logger.ts (structured logger that persists logs)
 * - ingestion/common/logging.py (Python ingestion service logging)
 */

import { prisma } from "@/lib/prisma"

export type LogSource = "nextjs" | "ingestion" | "database"

export interface LogEntry {
  timestamp: string
  level: "debug" | "info" | "warn" | "error"
  message: string
  service: string
  context?: Record<string, unknown>
}

/**
 * Get logs with pagination and filtering
 *
 * Retrieves logs from the database with support for filtering by source, level,
 * date range, and search terms. Results are paginated for performance.
 *
 * @param filters - Filter and pagination options
 * @returns Paginated logs
 */
export async function getLogs(filters: {
  source?: LogSource | "all"
  level?: "debug" | "info" | "warn" | "error"
  startDate?: Date
  endDate?: Date
  search?: string
  page?: number
  pageSize?: number
}): Promise<{
  logs: LogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const skip = (page - 1) * pageSize

  // Build where clause for filtering
  const where: {
    service?: string
    level?: string
    createdAt?: { gte?: Date; lte?: Date }
    OR?: Array<{ message?: { contains: string; mode?: "insensitive" } }>
  } = {}

  // Filter by source (service)
  if (filters.source && filters.source !== "all") {
    where.service = filters.source
  }

  // Filter by level
  if (filters.level) {
    where.level = filters.level.toLowerCase()
  }

  // Filter by date range
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate
    }
  }

  // Filter by search term (searches in message)
  if (filters.search && filters.search.trim()) {
    where.OR = [
      {
        message: {
          contains: filters.search.trim(),
          mode: "insensitive",
        },
      },
    ]
  }

  try {
    // Get total count for pagination
    const total = await prisma.applicationLog.count({ where })

    // Get paginated logs, ordered by most recent first
    const logs = await prisma.applicationLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
    })

    // Transform database records to LogEntry format
    const logEntries: LogEntry[] = logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      level: log.level as "debug" | "info" | "warn" | "error",
      message: log.message,
      service: log.service,
      context: log.context as Record<string, unknown> | undefined,
    }))

    const totalPages = Math.ceil(total / pageSize)

    return {
      logs: logEntries,
      total,
      page,
      pageSize,
      totalPages,
    }
  } catch (error) {
    // If database query fails, return empty results
    // This prevents the admin console from breaking if there's a DB issue
    console.error("Failed to retrieve logs from database:", error)
    return {
      logs: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    }
  }
}

/**
 * Get available log sources with metadata
 *
 * @returns Array of available log sources with descriptions
 */
export function getLogSources(): Array<{
  id: LogSource
  name: string
  description: string
}> {
  return [
    {
      id: "nextjs",
      name: "Next.js Application",
      description: "Logs from the Next.js web application",
    },
    {
      id: "ingestion",
      name: "Ingestion Service",
      description: "Logs from the Python ingestion service",
    },
    {
      id: "database",
      name: "Database",
      description: "Database operation logs",
    },
  ]
}
