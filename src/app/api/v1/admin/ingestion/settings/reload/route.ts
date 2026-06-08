/**
 * @fileoverview Reload ingestion settings caches (admin)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { reloadIngestionSettingsCaches } from "@/core/admin/ingestion-settings"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

export async function POST(_request: NextRequest) {
  const requestId = generateRequestId()

  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    await reloadIngestionSettingsCaches()
    return successResponse({ reloadedAt: new Date().toISOString() }, 200, "Settings cache reloaded")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
