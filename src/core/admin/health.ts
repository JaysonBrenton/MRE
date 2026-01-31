/**
 * @fileoverview Health check operations for admin console
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Functions for performing detailed health checks
 *
 * @purpose Provides comprehensive health check functionality for administrators,
 *          including database connectivity, ingestion service status, and system metrics.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/admin/ingestion.ts (ingestion service health)
 */

import { prisma } from "@/lib/prisma"
import { getIngestionServiceHealth } from "./ingestion"

export interface HealthCheckResult {
  component: string
  status: "healthy" | "degraded" | "unhealthy"
  message: string
  details?: Record<string, unknown>
  responseTime?: number
}

/**
 * Perform comprehensive health checks
 *
 * @returns Array of health check results
 */
export async function performHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  // Database health check
  try {
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - startTime

    // Get database size
    let dbSize: string | null = null
    try {
      const sizeResult = await prisma.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `
      dbSize = sizeResult[0]?.size ?? null
    } catch {
      // Ignore errors getting database size
    }

    results.push({
      component: "database",
      status: responseTime < 100 ? "healthy" : responseTime < 500 ? "degraded" : "unhealthy",
      message: "Database is accessible",
      details: {
        responseTime,
        size: dbSize,
      },
      responseTime,
    })
  } catch (error) {
    results.push({
      component: "database",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database connection failed",
    })
  }

  // Ingestion service health check
  try {
    const ingestionHealth = await getIngestionServiceHealth()
    results.push({
      component: "ingestion_service",
      status: ingestionHealth.healthy ? "healthy" : "unhealthy",
      message: ingestionHealth.message,
      responseTime: ingestionHealth.responseTime,
    })
  } catch (error) {
    results.push({
      component: "ingestion_service",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Failed to check ingestion service",
    })
  }

  // System memory check (Node.js)
  try {
    const memoryUsage = process.memoryUsage()
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    }

    // Consider memory healthy if heap used is less than 80% of heap total
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    const status =
      heapUsagePercent < 70 ? "healthy" : heapUsagePercent < 85 ? "degraded" : "unhealthy"

    results.push({
      component: "memory",
      status,
      message: `Memory usage: ${Math.round(heapUsagePercent)}%`,
      details: memoryUsageMB,
    })
  } catch (error) {
    results.push({
      component: "memory",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Failed to check memory",
    })
  }

  return results
}
