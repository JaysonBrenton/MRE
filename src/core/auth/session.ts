/**
 * @fileoverview Session management functions
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Centralizes session creation and management logic for both
 *              web (cookie-based) and future mobile (token-based) authentication
 * 
 * @purpose This file centralizes session management per the architecture
 *          requirement that sessions must be created only inside
 *          src/core/auth/session.ts. This ensures consistent session handling
 *          across web and mobile clients. During Alpha, web uses cookies,
 *          but the architecture is ready for token-based mobile sessions.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration)
 * - src/lib/session.ts (session helpers)
 * - src/core/auth/login.ts (authentication logic)
 */

import { auth } from "@/lib/auth"
import type { Session } from "next-auth"

/**
 * Get the current user session
 * 
 * @returns Current session or null if not authenticated
 */
export async function getCurrentSession(): Promise<Session | null> {
  const session = await auth()
  return session
}

/**
 * Get the current authenticated user
 * 
 * @returns Current user or null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getCurrentSession()
  return session?.user || null
}

/**
 * Require authentication - throws if user is not authenticated
 * 
 * @returns Current session
 * @throws Error if user is not authenticated
 */
export async function requireAuth(): Promise<Session> {
  const session = await getCurrentSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Require admin access - throws if user is not admin
 * 
 * @returns Current session with admin user
 * @throws Error if user is not authenticated or not admin
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth()
  if (!session.user.isAdmin) {
    throw new Error("Forbidden: Admin access required")
  }
  return session
}

/**
 * Check if current user is admin
 * 
 * @returns True if user is authenticated and is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.isAdmin ?? false
}

