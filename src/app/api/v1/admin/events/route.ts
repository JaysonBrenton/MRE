/**
 * @fileoverview Admin events API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for event management (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/events.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getEvents } from "@/core/admin/events"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/events
 * 
 * Get all events with pagination and filtering (admin only)
 * 
 * Query params:
 * - trackId (optional): Filter by track ID
 * - startDate (optional): Filter by start date (ISO string)
 * - endDate (optional): Filter by end date (ISO string)
 * - ingestDepth (optional): Filter by ingestion depth (none, laps_full)
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
    const trackId = searchParams.get("trackId") || undefined
    const startDateParam = searchParams.get("startDate")
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDateParam = searchParams.get("endDate")
    const endDate = endDateParam ? new Date(endDateParam) : undefined
    const ingestDepth = searchParams.get("ingestDepth") as "none" | "laps_full" | null
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 50

    const result = await getEvents({
      trackId,
      startDate,
      endDate,
      ingestDepth: ingestDepth || undefined,
      page,
      pageSize,
    })

    return successResponse(result, 200, "Events retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
