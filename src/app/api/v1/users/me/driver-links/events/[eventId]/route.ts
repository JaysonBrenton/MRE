/**
 * @fileoverview Driver link status update API endpoint (current user, by event)
 *
 * @created 2025-02-14
 * @creator System
 * @lastModified 2026-01-21
 *
 * @description Handles PATCH requests to update driver link status for the
 *               currently authenticated user based on event ID.
 *
 * @purpose Allows clients to confirm or reject suggested driver links without
 *          needing to know the user's ID ahead of time.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { handleDriverLinkStatusPatch } from "@/app/api/v1/users/driver-links/events-handler"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()

  console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Request received")

  try {
    const session = await auth()

    console.log("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userIdType: typeof session?.user?.id,
      userIdLength: session?.user?.id?.length,
    })

    if (!session || !session.user?.id) {
      console.log(
        "[PATCH /api/v1/users/me/driver-links/events/[eventId]] No session or user ID, returning 401"
      )
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { eventId } = await params
    console.log(
      "[PATCH /api/v1/users/me/driver-links/events/[eventId]] Calling handleDriverLinkStatusPatch:",
      {
        userId: session.user.id,
        eventId,
      }
    )

    return await handleDriverLinkStatusPatch(request, session.user.id, eventId)
  } catch (error: unknown) {
    console.error("[PATCH /api/v1/users/me/driver-links/events/[eventId]] Error:", error)

    // Check for specific "not found" errors and return 404
    if (error instanceof Error && error.message.includes("No driver link found")) {
      return errorResponse("NOT_FOUND", error.message, undefined, 404)
    }
    if (error instanceof Error && error.message === "User not found") {
      return errorResponse("NOT_FOUND", error.message, undefined, 404)
    }

    // Handle all other errors using the standard error handler
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
