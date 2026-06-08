/**
 * @fileoverview Admin ingestion settings API (read + write Phase 2)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import {
  listAdminIngestionSettings,
  patchAdminIngestionSettings,
} from "@/core/admin/ingestion-settings"
import {
  isIngestionSettingsWritable,
  patchBodySchema,
  IngestionSettingsValidationError,
} from "@/core/admin/ingestion-settings-validation"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId, getClientIp } from "@/lib/request-context"

export async function GET(_request: NextRequest) {
  const requestId = generateRequestId()

  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const data = await listAdminIngestionSettings()
    return successResponse(data, 200, "Ingestion settings loaded successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    if (!isIngestionSettingsWritable()) {
      return errorResponse(
        "FORBIDDEN",
        "Ingestion settings are read-only (ADMIN_INGESTION_SETTINGS_WRITABLE=false)",
        undefined,
        403
      )
    }

    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const body = patchBodySchema.parse(await request.json())
    const result = await patchAdminIngestionSettings(
      body,
      authResult.userId,
      getClientIp(request),
      request.headers.get("user-agent") ?? undefined
    )

    return successResponse(
      { updated: result.updated, settings: result.settings },
      200,
      "Settings updated successfully"
    )
  } catch (error: unknown) {
    if (error instanceof IngestionSettingsValidationError) {
      return errorResponse(error.code, error.message, error.details, 400)
    }
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
