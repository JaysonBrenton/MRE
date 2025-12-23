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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

