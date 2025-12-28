/**
 * @fileoverview Admin event re-ingestion API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles POST requests for marking events for re-ingestion (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/events.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { markEventForReingestion } from "@/core/admin/events"
import { successResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * POST /api/v1/admin/events/[eventId]/reingest
 * 
 * Mark event for re-ingestion (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  
  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { eventId } = await params

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const event = await markEventForReingestion(
      eventId,
      authResult.userId,
      ipAddress,
      userAgent
    )

    return successResponse(event, 200, "Event marked for re-ingestion successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
