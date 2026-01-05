/**
 * @fileoverview Request context utilities for logging
 *
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 *
 * @description Utilities for extracting and managing request context for logging
 *
 * @purpose Provides functions to extract request context from Next.js requests
 *          and create logger instances with that context. Ensures consistent
 *          request tracking across all logs.
 *
 * @relatedFiles
 * - src/lib/logger.ts (logger with context support)
 */

import { NextRequest } from "next/server"
import { createLoggerWithContext, type LogContext } from "./logger"
import { getQueryCount, getSlowQueries } from "./prisma"
import { initializeRequestStorage } from "./request-storage"

/**
 * Generate a unique request ID (UUID v4)
 */
export function generateRequestId(): string {
  // Simple UUID v4 implementation (for version 0.1.1, console-based logging)
  // In production, consider using crypto.randomUUID() if available
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations (X-Forwarded-For, X-Real-IP)
 */
export function getClientIp(request: NextRequest): string {
  // Check X-Forwarded-For header (may contain multiple IPs)
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    // Take the first IP (original client)
    const ips = forwardedFor.split(",").map((ip) => ip.trim())
    if (ips[0]) {
      return ips[0]
    }
  }

  // Check X-Real-IP header
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  // Fallback to request IP (may be undefined in some environments)
  const requestIp = (request as { ip?: string }).ip
  return requestIp || "unknown"
}

/**
 * Extract request context from NextRequest
 *
 * @param request - Next.js request object
 * @param requestId - Optional request ID (will generate if not provided)
 * @param userId - Optional user ID from session
 * @returns LogContext object with request information
 */
export function getRequestContext(
  request: NextRequest,
  requestId?: string,
  userId?: string
): LogContext {
  const context: LogContext = {
    requestId: requestId || generateRequestId(),
    ip: getClientIp(request),
    path: request.nextUrl.pathname,
    method: request.method,
    userAgent: request.headers.get("user-agent") || undefined,
  }

  if (userId) {
    context.userId = userId
  }

  return context
}

/**
 * Create a logger instance with request context
 *
 * @param request - Next.js request object
 * @param requestId - Optional request ID (will generate if not provided)
 * @param userId - Optional user ID from session
 * @returns Logger instance with request context
 */
export function createRequestLogger(request: NextRequest, requestId?: string, userId?: string) {
  // Initialize request-scoped storage for query telemetry
  // This ensures each request has isolated metrics
  initializeRequestStorage()

  const context = getRequestContext(request, requestId, userId)
  const logger = createLoggerWithContext(context)

  // Add query count tracking wrapper
  const originalInfo = logger.info.bind(logger)
  logger.info = (message: string, meta?: Record<string, unknown>) => {
    const queryCount = getQueryCount()
    const slowQueries = getSlowQueries()

    const enhancedMeta = {
      ...meta,
      prismaQueryCount: queryCount,
      ...(slowQueries.length > 0 && {
        slowQueries: slowQueries.map((q) => ({
          duration: q.duration,
          query: q.query.substring(0, 200), // Truncate long queries
        })),
      }),
    }

    return originalInfo(message, enhancedMeta)
  }

  return logger
}
