/**
 * GET /api/v1/telemetry/sessions/compare?ids=uuid,uuid[,uuid] — lap comparison (2–4 READY sessions).
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import {
  buildTelemetryComparePayload,
  parseCompareSessionIdsParam,
} from "@/core/telemetry/telemetry-compare"
import { getTelemetrySessionsForCompare } from "@/core/telemetry/telemetry-repo"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const ids = parseCompareSessionIdsParam(request.nextUrl.searchParams.get("ids"))
    if (!ids) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Provide ids=uuid,uuid (2–4 READY sessions)",
        undefined,
        400
      )
    }

    const rows = await getTelemetrySessionsForCompare(session.user.id, ids)
    if (rows.length !== ids.length) {
      return errorResponse(
        "NOT_FOUND",
        "One or more sessions were not found or not ready",
        undefined,
        404
      )
    }

    const byId = new Map(rows.map((r) => [r.id, r]))
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is (typeof rows)[number] => r != null)
    const payload = buildTelemetryComparePayload(ordered)

    return successResponse(payload, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
