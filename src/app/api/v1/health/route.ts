/**
 * @fileoverview Health check endpoint for Docker health checks
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Simple health check endpoint that returns 200 OK when the service is healthy.
 *              Uses standardized response format for consistency with other API endpoints.
 *
 * @relatedFiles
 * - src/lib/api-utils.ts (response helpers)
 */

import { successResponse } from "@/lib/api-utils"

export async function GET() {
  return successResponse(
    { status: "healthy", timestamp: new Date().toISOString() },
    200,
    "Service is healthy"
  )
}
