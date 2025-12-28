/**
 * @fileoverview Admin audit logs API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for audit logs (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/audit.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getAuditLogs } from "@/core/admin/audit"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/audit
 * 
 * Get audit logs with pagination and filtering (admin only)
 * 
 * Query params:
 * - userId (optional): Filter by user ID
 * - action (optional): Filter by action
 * - resourceType (optional): Filter by resource type
 * - resourceId (optional): Filter by resource ID
 * - startDate (optional): Filter by start date (ISO string)
 * - endDate (optional): Filter by end date (ISO string)
 * - page (optional): Page number (default: 1)
 * - pageSize (optional): Page size (default: 50)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId") || undefined
    const action = searchParams.get("action") || undefined
    const resourceType = searchParams.get("resourceType") || undefined
    const resourceId = searchParams.get("resourceId") || undefined
    const startDateParam = searchParams.get("startDate")
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDateParam = searchParams.get("endDate")
    const endDate = endDateParam ? new Date(endDateParam) : undefined
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 50

    const result = await getAuditLogs({
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      page,
      pageSize,
    })

    return successResponse(result, 200, "Audit logs retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
