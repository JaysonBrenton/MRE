/**
 * GET / PUT / DELETE /api/v1/user/events/[eventId]/host-track
 * Per-user catalogue host track for event analysis.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { formatTrackAddress } from "@/lib/address-normalization"
import {
  deleteUserEventHostTrack,
  getUserEventHostTrackRow,
  upsertUserEventHostTrack,
} from "@/core/events/user-event-host-track"
import { successResponse, errorResponse, parseRequestBody, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

function serializeHostTrack(
  row: NonNullable<Awaited<ReturnType<typeof getUserEventHostTrackRow>>>
) {
  const ht = row.hostTrack
  return {
    trackId: ht.id,
    trackName: ht.trackName,
    trackDashboardUrl: ht.trackUrl?.trim() ? ht.trackUrl.trim() : null,
    website: ht.website ?? null,
    facebookUrl: ht.facebookUrl ?? null,
    address: formatTrackAddress(ht),
    phone: ht.phone ?? null,
    email: ht.email ?? null,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }
    const { eventId } = await params
    const row = await getUserEventHostTrackRow(session.user.id, eventId)
    if (!row) {
      return successResponse({ hostTrack: null }, 200, undefined, CACHE_CONTROL.NO_CACHE)
    }
    return successResponse(
      { hostTrack: serializeHostTrack(row) },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }
    const { eventId } = await params
    const parsed = await parseRequestBody<{ hostTrackId?: string }>(request)
    if (!parsed.success || !parsed.data) {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }
    const hostTrackId =
      typeof parsed.data.hostTrackId === "string" ? parsed.data.hostTrackId.trim() : ""
    if (!hostTrackId) {
      return errorResponse("VALIDATION_ERROR", "hostTrackId is required", undefined, 400)
    }
    try {
      const row = await upsertUserEventHostTrack(session.user.id, eventId, hostTrackId)
      return successResponse(
        { hostTrack: serializeHostTrack(row) },
        200,
        undefined,
        CACHE_CONTROL.NO_CACHE
      )
    } catch (e) {
      const code = (e as Error & { code?: string }).code
      if (code === "EVENT_NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Event not found", undefined, 404)
      }
      if (code === "TRACK_NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Track not found or inactive", undefined, 404)
      }
      throw e
    }
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }
    const { eventId } = await params
    await deleteUserEventHostTrack(session.user.id, eventId)
    return successResponse({ ok: true }, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
