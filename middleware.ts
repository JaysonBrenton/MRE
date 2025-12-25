/**
 * @fileoverview Next.js middleware for route protection, rate limiting, and security headers
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Middleware configuration for authentication, route protection, rate limiting, and security headers
 * 
 * @purpose This middleware combines NextAuth's auth function with rate limiting and security headers to:
 *          1. Protect authentication endpoints from brute force attacks
 *          2. Protect resource-intensive endpoints from abuse
 *          3. Handle authentication redirects for protected routes
 *          4. Add security headers to protect against common web vulnerabilities
 * 
 *          Rate limits are applied BEFORE authentication checks to prevent
 *          attackers from consuming resources even with invalid credentials.
 *          Security headers are added to all responses to protect against XSS,
 *          clickjacking, and other attacks.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration and auth function)
 * - src/lib/rate-limiter.ts (rate limiting implementation)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture rules)
 * - docs/security/security-overview.md (security documentation)
 * - docs/architecture/security-headers-plan.md (security headers implementation plan)
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
import { env } from "@/lib/env"

/**
 * Add security headers to response
 * Environment-aware: relaxed for development, strict for production
 * 
 * @param response - NextResponse to add headers to
 * @param isProduction - Whether running in production environment
 * @returns Response with security headers added
 */
function addSecurityHeaders(response: NextResponse, isProduction: boolean): NextResponse {
  // Basic security headers (always applied)
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  )

  // Content-Security-Policy (environment-aware)
  if (isProduction) {
    // Strict CSP for production
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
    response.headers.set("Content-Security-Policy", csp)
    
    // HSTS (production only)
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  } else {
    // Relaxed CSP for development (allows hot reload and dev tools)
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: http://localhost:* https://localhost:*",
      "frame-ancestors 'none'",
    ].join("; ")
    response.headers.set("Content-Security-Policy", csp)
  }

  return response
}

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
 * Applies rate limiting first, then delegates to NextAuth for authentication,
 * and adds security headers to all responses
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const context = getRequestContext(request)
  const requestLogger = createLoggerWithContext(context)
  const isProduction = env.NODE_ENV === "production"

  try {
    // Apply rate limiting to API endpoints
    if (pathname.startsWith("/api/")) {
      const rateLimitResponse = checkRateLimit(request)
      if (rateLimitResponse) {
        // Add security headers to rate limit response
        return addSecurityHeaders(rateLimitResponse, isProduction)
      }
    }

    // Delegate to NextAuth for authentication on protected routes
    // The auth() function handles:
    // - Session validation
    // - Redirects for unauthenticated users
    // - Admin role checks
    const authResponse = await auth(request as any)
    
    // Add security headers to auth response
    // auth() returns NextResponse or Response, so we need to handle both
    if (authResponse instanceof NextResponse) {
      return addSecurityHeaders(authResponse, isProduction)
    }
    
    // If auth() returns a Response (not NextResponse), convert it
    const nextResponse = NextResponse.next(authResponse)
    return addSecurityHeaders(nextResponse, isProduction)
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

    // Create error response with security headers
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    )
    return addSecurityHeaders(errorResponse, isProduction)
  }
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
