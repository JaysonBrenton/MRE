import { NextRequest } from "next/server"

import { requireAdmin } from "@/lib/admin-auth"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { getTrackSyncJobStatus } from "@/core/admin/ingestion"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = generateRequestId()

  try {
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { jobId } = await params

    if (!jobId) {
      return errorResponse("BAD_REQUEST", "jobId is required", undefined, 400)
    }

    const status = await getTrackSyncJobStatus(jobId)
    return successResponse(status, 200, "Job status fetched")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
