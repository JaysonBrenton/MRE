/**
 * @fileoverview API route performance wrapper
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Higher-order function to wrap API route handlers with performance logging
 * 
 * @purpose Automatically measures and logs slow API requests. Can be used to wrap
 *          API route handlers for consistent performance monitoring.
 * 
 * @relatedFiles
 * - src/lib/performance-logger.ts (performance logging utilities)
 * - src/lib/request-context.ts (request context)
 */

import { NextRequest, NextResponse } from "next/server"
import { logSlowRequest } from "./performance-logger"
import { createRequestLogger, generateRequestId } from "./request-context"

/**
 * Wrap an API route handler with performance logging
 * 
 * @param handler - API route handler function
 * @returns Wrapped handler with performance logging
 */
export function withPerformanceLogging<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>
) {
  return async (request: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestId = generateRequestId()
    const requestLogger = createRequestLogger(request, requestId)

    try {
      const response = await handler(request)
      const duration = Date.now() - startTime

      // Log slow requests
      logSlowRequest(
        request.nextUrl.pathname,
        request.method,
        duration,
        {
          ...requestLogger,
          requestId,
          statusCode: response.status,
          duration,
        }
      )

      // Add performance headers
      const headers = new Headers(response.headers)
      headers.set("X-Request-ID", requestId)
      headers.set("X-Response-Time", `${duration}ms`)

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      requestLogger.error("API route error", {
        duration,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

