/**
 * @fileoverview Driver link status update API endpoint (by event)
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Handles PATCH requests to update driver link status based on event ID
 *
 * @purpose Allows users to confirm or reject driver link suggestions for specific events.
 *          This endpoint updates the UserDriverLink status, which affects all events
 *          for that driver link.
 *
 * @relatedFiles
 * - src/core/users/driver-links.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { updateDriverLinkStatusByEvent } from "@/core/users/driver-links"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * PATCH /api/v1/users/[userId]/driver-links/events/[eventId]
 *
 * Update driver link status for an event (confirm or reject)
 *
 * Request body:
 * {
 *   status: "confirmed" | "rejected"
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     link: DriverLinkStatus
 *   }
 * }
 */
export async function handleDriverLinkStatusPatch(
  request: NextRequest,
  userId: string,
  eventId: string
) {
  console.log("[handleDriverLinkStatusPatch] Called with:", { userId, eventId })
  
  // Parse request body
  const bodyResult = await parseRequestBody<{
    status: "confirmed" | "rejected"
  }>(request)

  console.log("[handleDriverLinkStatusPatch] Body parse result:", {
    success: bodyResult.success,
    status: bodyResult.success ? bodyResult.data.status : "N/A",
  })

  if (!bodyResult.success) {
    console.log("[handleDriverLinkStatusPatch] Body parse failed, returning error")
    return bodyResult.response
  }

  const { status } = bodyResult.data

  if (status !== "confirmed" && status !== "rejected") {
    console.log("[handleDriverLinkStatusPatch] Invalid status:", status)
    return errorResponse(
      "INVALID_INPUT",
      "Status must be 'confirmed' or 'rejected'",
      undefined,
      400
    )
  }

  console.log("[handleDriverLinkStatusPatch] Calling updateDriverLinkStatusByEvent:", {
    userId,
    eventId,
    status,
  })

  // Update driver link status
  const updatedLink = await updateDriverLinkStatusByEvent(userId, eventId, status)

  console.log("[handleDriverLinkStatusPatch] Update result:", {
    hasUpdatedLink: !!updatedLink,
    linkId: updatedLink?.id,
    linkStatus: updatedLink?.status,
  })

  return successResponse({ link: updatedLink }, 200, `Driver link ${status} successfully`)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; eventId: string }> }
) {
  const requestId = generateRequestId()

  try {
    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { userId, eventId } = await params

    // Verify userId matches authenticated user
    if (session.user.id !== userId) {
      return errorResponse("FORBIDDEN", "Access denied", undefined, 403)
    }

    return handleDriverLinkStatusPatch(request, userId, eventId)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
