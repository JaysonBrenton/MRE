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
import { handleDriverLinkStatusPatch } from "@/app/api/v1/users/driver-links/events-handler"
import { errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * PATCH /api/v1/users/[userId]/driver-links/events/[eventId]
 *
 * Update driver link status for an event (confirm or reject)
 */
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
