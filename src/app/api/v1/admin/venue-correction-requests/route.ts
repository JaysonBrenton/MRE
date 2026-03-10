/**
 * @fileoverview Admin API endpoint for venue correction requests
 *
 * @description GET: List pending (and optionally all) venue correction requests (admin only)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listVenueCorrectionRequests } from "@/core/events/venue-correction"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import type { EventVenueCorrectionRequestStatus } from "@prisma/client"

/**
 * GET /api/v1/admin/venue-correction-requests
 *
 * List venue correction requests (admin only)
 * Query params: status (optional) - pending | approved | rejected
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const searchParams = request.nextUrl.searchParams
    const statusParam = searchParams.get("status") as EventVenueCorrectionRequestStatus | null
    const status =
      statusParam && ["pending", "approved", "rejected"].includes(statusParam)
        ? statusParam
        : undefined

    const requests = await listVenueCorrectionRequests({ status })
    return successResponse({ requests }, 200, "Venue correction requests retrieved")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
