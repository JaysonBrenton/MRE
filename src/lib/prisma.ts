/**
 * @fileoverview Prisma client singleton instance
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Prisma database client with singleton pattern for development
 *
 * @purpose Provides a singleton Prisma client instance that is reused across
 *          the application. In development, the instance is stored globally to
 *          prevent multiple instances during hot reload. This client should only
 *          be used by repository files in src/core/<domain>/repo.ts per the
 *          architecture requirements.
 *
 * @relatedFiles
 * - src/core/users/repo.ts (uses this client)
 * - prisma/schema.prisma (database schema)
 */

import { PrismaClient } from "@prisma/client"
import { env } from "./env"
import { getOrInitializeRequestStorage } from "./request-storage"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const SLOW_QUERY_THRESHOLD_MS = 100

/**
 * Prisma connection pool configuration
 *
 * Prisma reads connection pool settings from DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections in the pool (default: 10)
 * - pool_timeout: Timeout in seconds for acquiring a connection (default: 10)
 *
 * To configure, add these to your DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10
 *
 * Recommended production values (matching Python ingestion service):
 * - connection_limit=10 (matches pool_size=10)
 * - pool_timeout=10
 */

/**
 * Validate DATABASE_URL contains recommended pool parameters
 *
 * Checks for connection_limit and pool_timeout in the DATABASE_URL query string.
 * Logs warnings in development, provides clear guidance in all environments.
 */
function validateDatabasePoolConfig(databaseUrl: string): void {
  try {
    const url = new URL(databaseUrl)
    const params = new URLSearchParams(url.search)

    const hasConnectionLimit = params.has("connection_limit")
    const hasPoolTimeout = params.has("pool_timeout")

    const missingParams: string[] = []
    if (!hasConnectionLimit) {
      missingParams.push("connection_limit")
    }
    if (!hasPoolTimeout) {
      missingParams.push("pool_timeout")
    }

    if (missingParams.length > 0) {
      const message =
        `DATABASE_URL is missing recommended pool parameters: ${missingParams.join(", ")}. ` +
        `Recommended format: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10. ` +
        `Recommended values: connection_limit=10, pool_timeout=10 (matching Python ingestion service).`

      if (env.NODE_ENV === "production") {
        // In production, log as warning but don't fail (allows flexibility)
        console.warn(`[DATABASE_URL Pool Config] ${message}`)
      } else {
        // In development, log as info for visibility
        console.info(`[DATABASE_URL Pool Config] ${message}`)
      }
    }
  } catch (error) {
    // If URL parsing fails, DATABASE_URL validation in env.ts will catch it
    // Just log and continue
    if (env.NODE_ENV === "development") {
      console.warn(
        "[DATABASE_URL Pool Config] Could not parse DATABASE_URL for pool config validation:",
        error
      )
    }
  }
}

// Validate pool configuration at startup
validateDatabasePoolConfig(env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? [
            {
              emit: "event",
              level: "query",
            },
            "error",
            "warn",
          ]
        : [
            {
              emit: "event",
              level: "query",
            },
            "error",
          ],
  })

// Track query performance in development and production
if (prisma) {
  prisma.$on("query" as never, (e: { query: string; duration: number; params?: unknown }) => {
    // Get request-scoped storage (or initialize if not set)
    const storage = getOrInitializeRequestStorage()

    storage.queryCount++

    // Log slow queries (> 100ms)
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      storage.slowQueries.push({
        query: e.query,
        duration: e.duration,
        params: e.params,
      })

      if (env.NODE_ENV === "development") {
        console.warn(`[Prisma Slow Query] ${e.duration}ms: ${e.query.substring(0, 200)}`)
      }
    }
  })
}

/**
 * Get current query count for this request
 * Resets after being called (for per-request tracking)
 *
 * Uses request-scoped storage to prevent concurrent requests from interfering.
 */
export function getQueryCount(): number {
  const storage = getOrInitializeRequestStorage()
  const count = storage.queryCount
  storage.queryCount = 0
  return count
}

/**
 * Get slow queries for this request
 * Clears after being called (for per-request tracking)
 *
 * Uses request-scoped storage to prevent concurrent requests from interfering.
 */
export function getSlowQueries(): Array<{ query: string; duration: number; params?: unknown }> {
  const storage = getOrInitializeRequestStorage()
  const queries = [...storage.slowQueries]
  storage.slowQueries = []
  return queries
}

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
