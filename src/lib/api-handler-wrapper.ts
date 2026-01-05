/**
 * @fileoverview Helper to wrap API route handlers with request storage initialization
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Provides a wrapper function to ensure request storage is initialized
 *              at the start of API route handlers
 *
 * @purpose Ensures request-scoped storage is properly initialized for query telemetry.
 *          This wrapper can be used to wrap API route handlers, or handlers can
 *          manually call initializeRequestStorage() at the start.
 *
 * @relatedFiles
 * - src/lib/request-storage.ts (request storage implementation)
 * - src/lib/prisma.ts (uses request storage for query telemetry)
 */

import { initializeRequestStorage } from "./request-storage"
import type { NextRequest } from "next/server"

/**
 * Wrapper function type for API route handlers
 */
type ApiHandler = (request: NextRequest, context?: unknown) => Promise<Response>

/**
 * Wrap an API route handler to initialize request storage
 *
 * This ensures request-scoped storage is available for query telemetry
 * and other per-request data.
 *
 * @param handler - API route handler function
 * @returns Wrapped handler that initializes request storage
 *
 * @example
 * ```typescript
 * export const GET = wrapApiHandler(async (request) => {
 *   // Request storage is now initialized
 *   // Query telemetry will be tracked per-request
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function wrapApiHandler(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    // Initialize request storage for this request
    initializeRequestStorage()

    // Call the original handler
    return handler(request, context)
  }
}
