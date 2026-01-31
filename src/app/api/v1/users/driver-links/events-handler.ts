/**
 * @fileoverview Shared handler for driver link status PATCH by event
 *
 * @description Handles the business logic for updating driver link status.
 *              Used by both /users/[userId]/driver-links/events/[eventId] and
 *              /users/me/driver-links/events/[eventId] routes.
 */

import { NextRequest } from "next/server"
import { updateDriverLinkStatusByEvent } from "@/core/users/driver-links"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"

export async function handleDriverLinkStatusPatch(
  request: NextRequest,
  userId: string,
  eventId: string
) {
  const bodyResult = await parseRequestBody<{
    status: "confirmed" | "rejected"
  }>(request)

  if (!bodyResult.success) {
    return bodyResult.response
  }

  const { status } = bodyResult.data

  if (status !== "confirmed" && status !== "rejected") {
    return errorResponse(
      "INVALID_INPUT",
      "Status must be 'confirmed' or 'rejected'",
      undefined,
      400
    )
  }

  const updatedLink = await updateDriverLinkStatusByEvent(userId, eventId, status)
  return successResponse({ link: updatedLink }, 200, `Driver link ${status} successfully`)
}
