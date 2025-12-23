/**
 * @fileoverview Next.js middleware for route protection and rate limiting
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Middleware configuration for authentication, route protection, and rate limiting
 * 
 * @purpose This middleware combines NextAuth's auth function with rate limiting to:
 *          1. Protect authentication endpoints from brute force attacks
 *          2. Protect resource-intensive endpoints from abuse
 *          3. Handle authentication redirects for protected routes
 * 
 *          Rate limits are applied BEFORE authentication checks to prevent
 *          attackers from consuming resources even with invalid credentials.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration and auth function)
 * - src/lib/rate-limiter.ts (rate limiting implementation)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture rules)
 * - docs/security/security-overview.md (security documentation)
 */

import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getRateLimiter,
  generateRateLimitKey,
  getRateLimitConfigForPath,
} from "@/lib/rate-limiter"
import { logger, createLoggerWithContext } from "@/lib/logger"
import { getRequestContext, getClientIp } from "@/lib/request-context"

/**
 * Check rate limit for API endpoints
 * Returns a 429 response if rate limit is exceeded
 */
function checkRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname

  // Get rate limit config for this path
  const config = getRateLimitConfigForPath(pathname)
  if (!config) {
    // No rate limiting for this path
    return null
  }

  // Get client IP and generate rate limit key
  const ip = getClientIp(request)
  const key = generateRateLimitKey(ip, pathname)

  // Check rate limit
  const limiter = getRateLimiter()
  const result = limiter.check(key, config)

  if (!result.allowed) {
    // Rate limit exceeded - log and return 429 response
    const context = getRequestContext(request)
    const requestLogger = createLoggerWithContext(context)
    
    requestLogger.warn("Rate limit exceeded", {
      ip,
      path: pathname,
      rateLimitConfig: {
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      },
      retryAfterSeconds: result.retryAfterSeconds,
      remaining: result.remaining,
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          details: {
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      }
    )
  }

  // Request allowed - add rate limit headers to response
  // Note: These headers will be added by the route handler
  // We could add them here but it requires response cloning
  return null
}

/**
 * Combined middleware function
 * Applies rate limiting first, then delegates to NextAuth for authentication
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const context = getRequestContext(request)
  const requestLogger = createLoggerWithContext(context)

  try {
    // Apply rate limiting to API endpoints
    if (pathname.startsWith("/api/")) {
      const rateLimitResponse = checkRateLimit(request)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
    }

    // Delegate to NextAuth for authentication on protected routes
    // The auth() function handles:
    // - Session validation
    // - Redirects for unauthenticated users
    // - Admin role checks
    const authResponse = await auth(request as any)
    return authResponse
  } catch (error) {
    // Log middleware errors
    requestLogger.error("Middleware error", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    })

    // Re-throw to let Next.js handle it
    throw error
  }
}

export const config = {
  matcher: [
    // Protected pages (for auth redirects)
    "/login",
    "/register",
    "/welcome",
    "/admin/:path*",
    "/dashboard",
    "/event-search",
    "/events/:path*",
    // Rate-limited API endpoints
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/events/:path*/ingest",
    "/api/v1/events/ingest",
    "/api/v1/events/discover",
  ],
}
