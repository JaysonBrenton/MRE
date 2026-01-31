/**
 * @fileoverview Session helper functions (deprecated - use src/core/auth/session.ts)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Legacy session helpers - these now delegate to core session functions
 *
 * @purpose This file provides backward-compatible session helpers that delegate
 *          to the core session functions in src/core/auth/session.ts. New code
 *          should import directly from src/core/auth/session.ts.
 *
 * @deprecated Use src/core/auth/session.ts instead
 *
 * @relatedFiles
 * - src/core/auth/session.ts (authoritative session functions)
 * - src/lib/auth.ts (NextAuth configuration)
 */

// Re-export from core for backward compatibility
export {
  getCurrentUser,
  requireAuth,
  requireAdmin,
  getCurrentSession,
  isAdmin,
} from "@/core/auth/session"
