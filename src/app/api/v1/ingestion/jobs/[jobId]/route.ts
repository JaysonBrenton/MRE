// @fileoverview Ingestion job status API route (proxy to Python service)
//
// @description Returns status of a queued ingestion job. Used when ingest
//              returns 202 Accepted; client polls this until completed/failed.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { ingestionClient } from "@/lib/ingestion-client"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)
  const { jobId } = await params

  const session = await auth()
  if (!session) {
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const status = await ingestionClient.getIngestionJobStatus(jobId)
    return successResponse(status)
  } catch (error) {
    requestLogger.error("Ingestion job status failed", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    })
    const message = error instanceof Error ? error.message : "Failed to get job status"
    const is404 = message.includes("404") || message.includes("not found")
    return errorResponse(
      is404 ? "NOT_FOUND" : "INGESTION_ERROR",
      message,
      {},
      is404 ? 404 : 502
    )
  }
}
