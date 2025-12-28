/**
 * @fileoverview Admin health checks API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for detailed health checks (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/health.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { performHealthChecks } from "@/core/admin/health"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/health
 * 
 * Perform detailed health checks (admin only)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const healthChecks = await performHealthChecks()

    return successResponse(healthChecks, 200, "Health checks completed successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
