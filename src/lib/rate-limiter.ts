/**
 * @fileoverview Rate limiting utility for API endpoints
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description In-memory rate limiter to prevent brute force and DoS attacks
 * 
 * @purpose Provides rate limiting functionality for API routes. Uses in-memory
 *          storage for Alpha. For production, consider Redis-based rate limiting.
 * 
 * @relatedFiles
 * - src/lib/api-utils.ts (error response helpers)
 * - middleware.ts (route protection)
 */

import { NextRequest } from "next/server"

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  max: number // Maximum requests per window
}

/**
 * Rate limit entry stored in memory
 */
interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * In-memory rate limit store
 * Note: For production, use Redis or similar distributed store
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Clean up expired entries periodically
 */
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL)

/**
 * Get client identifier from request
 * Uses IP address for identification
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const ip = forwarded?.split(",")[0] || realIp || request.ip || "unknown"
  return ip
}

/**
 * Check if request should be rate limited
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Object with allowed status and rate limit info
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const clientId = getClientId(request)
  const now = Date.now()
  
  let entry = rateLimitStore.get(clientId)
  
  // Create new entry or reset if window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
  }
  
  // Increment count
  entry.count++
  rateLimitStore.set(clientId, entry)
  
  const allowed = entry.count <= config.max
  const remaining = Math.max(0, config.max - entry.count)
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
  },
  // Ingestion endpoints - moderate limits
  ingestion: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
  },
  // General API endpoints - lenient limits
  general: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },
} as const

