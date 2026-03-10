/**
 * @fileoverview Admin API endpoint for venue correction request review
 *
 * @description PATCH: Approve or reject a venue correction request (admin only)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { reviewVenueCorrectionRequest } from "@/core/events/venue-correction"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * PATCH /api/v1/admin/venue-correction-requests/[id]
 *
 * Approve or reject a venue correction request (admin only)
 * Body: { action: "approve" | "reject", adminNotes?: string }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()

  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { id } = await params
    if (!id) {
      return errorResponse("INVALID_REQUEST", "Request ID is required", undefined, 400)
    }

    const bodyResult = await parseRequestBody<{
      action?: string
      adminNotes?: string | null
    }>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }
    const body = bodyResult.data
    const action = body.action
    const adminNotes = body.adminNotes ?? null

    if (action !== "approve" && action !== "reject") {
      return errorResponse(
        "INVALID_REQUEST",
        "action must be 'approve' or 'reject'",
        undefined,
        400
      )
    }

    const result = await reviewVenueCorrectionRequest(id, authResult.userId, action, adminNotes)

    if (!result) {
      return errorResponse("NOT_FOUND", "Venue correction request not found", undefined, 404)
    }

    return successResponse(
      result,
      200,
      result.action === "approved"
        ? "Venue correction approved"
        : "Venue correction request rejected"
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
