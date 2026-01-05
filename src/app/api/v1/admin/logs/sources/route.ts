/**
 * @fileoverview Admin log sources API endpoint (v1)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles GET requests for log sources (admin only)
 *
 * @relatedFiles
 * - src/core/admin/logs.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getLogSources } from "@/core/admin/logs"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/logs/sources
 *
 * Get available log sources (admin only)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const sources = getLogSources()

    return successResponse({ sources }, 200, "Log sources retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
