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

import { PrismaClient } from '@prisma/client'
import { env } from './env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Query performance tracking
let queryCount = 0
let slowQueries: Array<{ query: string; duration: number; params?: unknown }> = []
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
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' 
      ? [
          {
            emit: 'event',
            level: 'query',
          },
          'error',
          'warn',
        ]
      : [
          {
            emit: 'event',
            level: 'query',
          },
          'error',
        ],
  })

// Track query performance in development and production
if (prisma) {
  prisma.$on('query' as never, (e: { query: string; duration: number; params?: unknown }) => {
    queryCount++
    
    // Log slow queries (> 100ms)
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      slowQueries.push({
        query: e.query,
        duration: e.duration,
        params: e.params,
      })
      
      if (env.NODE_ENV === 'development') {
        console.warn(`[Prisma Slow Query] ${e.duration}ms: ${e.query.substring(0, 200)}`)
      }
    }
  })
}

/**
 * Get current query count for this request/process
 * Resets after being called (for per-request tracking)
 */
export function getQueryCount(): number {
  const count = queryCount
  queryCount = 0
  return count
}

/**
 * Get slow queries for this request/process
 * Clears after being called (for per-request tracking)
 */
export function getSlowQueries(): Array<{ query: string; duration: number; params?: unknown }> {
  const queries = [...slowQueries]
  slowQueries = []
  return queries
}

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

