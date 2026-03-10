/**
 * @fileoverview API endpoint for event venue correction
 *
 * @description POST: Submit/update venue correction request (event-linked users)
 *              DELETE: Undo own pending request
 *              GET: Get approved correction and current user's request status
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import {
  isEventLinkedUser,
  submitVenueCorrectionRequest,
  deleteOwnPendingRequest,
  getApprovedCorrection,
  getUserRequestForEvent,
} from "@/core/events/venue-correction"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { eventId } = await params
    if (!eventId) {
      return errorResponse("INVALID_REQUEST", "eventId is required", undefined, 400)
    }

    const correction = await getApprovedCorrection(eventId)
    const userRequest = await getUserRequestForEvent(eventId, session.user.id)
    const isEventLinked = await isEventLinkedUser(eventId, session.user.id)

    return successResponse({
      correction: correction
        ? {
            id: correction.id,
            eventId: correction.eventId,
            venueTrackId: correction.venueTrackId,
            venueTrackName: correction.venueTrackName,
          }
        : null,
      userRequest: userRequest
        ? {
            id: userRequest.id,
            status: userRequest.status,
            venueTrackId: userRequest.venueTrackId,
            venueTrackName: userRequest.venueTrackName,
            adminNotes: userRequest.adminNotes,
          }
        : null,
      canSubmit: isEventLinked && !correction,
    })
  } catch (error) {
    console.error("[API] Error getting venue correction:", error)
    return errorResponse("INTERNAL_ERROR", "Failed to get venue correction", undefined, 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { eventId } = await params
    if (!eventId) {
      return errorResponse("INVALID_REQUEST", "eventId is required", undefined, 400)
    }

    const bodyResult = await parseRequestBody<{ venueTrackId?: string | null }>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }
    const body = bodyResult.data
    const venueTrackId = body.venueTrackId === undefined ? null : body.venueTrackId

    const result = await submitVenueCorrectionRequest(eventId, session.user.id, venueTrackId)
    return successResponse(
      {
        id: result.id,
        eventId: result.eventId,
        venueTrackId: result.venueTrackId,
        venueTrackName: result.venueTrackName,
        status: result.status,
      },
      200,
      "Venue correction submitted for admin review"
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit venue correction"
    if (message.includes("Only event-linked users")) {
      return errorResponse("FORBIDDEN", message, undefined, 403)
    }
    if (message.includes("Event not found")) {
      return errorResponse("NOT_FOUND", message, undefined, 404)
    }
    if (message.includes("Track not found")) {
      return errorResponse("NOT_FOUND", message, undefined, 404)
    }
    console.error("[API] Error submitting venue correction:", error)
    return errorResponse("INTERNAL_ERROR", "Failed to submit venue correction", undefined, 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { eventId } = await params
    if (!eventId) {
      return errorResponse("INVALID_REQUEST", "eventId is required", undefined, 400)
    }

    const deleted = await deleteOwnPendingRequest(eventId, session.user.id)
    if (!deleted) {
      return errorResponse(
        "NOT_FOUND",
        "No pending venue correction request found for you to undo",
        undefined,
        404
      )
    }
    return successResponse({}, 200, "Venue correction request undone")
  } catch (error) {
    console.error("[API] Error undoing venue correction:", error)
    return errorResponse("INTERNAL_ERROR", "Failed to undo venue correction", undefined, 500)
  }
}
