/**
 * @fileoverview Admin ingestion controls API endpoint (v1)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles POST requests for ingestion controls (admin only)
 *
 * @relatedFiles
 * - src/core/admin/ingestion.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { triggerTrackSync, triggerEventIngestion } from "@/core/admin/ingestion"
import { successResponse, parseRequestBody, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * POST /api/v1/admin/ingestion/trigger
 *
 * Trigger ingestion job (admin only)
 *
 * Request body:
 * {
 *   type: "track_sync" | "event_ingestion"
 *   eventId?: string (required if type is "event_ingestion")
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const bodyResult = await parseRequestBody<{
      type: "track_sync" | "event_ingestion"
      eventId?: string
    }>(request)

    if (!bodyResult.success) {
      return bodyResult.response
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    if (bodyResult.data.type === "track_sync") {
      const result = await triggerTrackSync(authResult.userId, ipAddress, userAgent)
      return successResponse({ jobId: result.jobId }, 200, "Track sync job created")
    } else if (bodyResult.data.type === "event_ingestion") {
      if (!bodyResult.data.eventId) {
        return successResponse(
          { success: false, message: "eventId is required for event ingestion" },
          400,
          "Missing eventId"
        )
      }
      const result = await triggerEventIngestion(
        bodyResult.data.eventId,
        authResult.userId,
        ipAddress,
        userAgent
      )
      return successResponse(result, 200, "Event ingestion triggered successfully")
    } else {
      return successResponse(
        { success: false, message: "Invalid ingestion type" },
        400,
        "Invalid request"
      )
    }
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
