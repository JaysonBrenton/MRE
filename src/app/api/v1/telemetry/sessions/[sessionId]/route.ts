/**
 * GET /api/v1/telemetry/sessions/{sessionId} — session metadata, datasets summary, processing status.
 */

import { NextRequest } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { telemetryFailureUserMessage } from "@/core/telemetry/telemetry-failure-messages"
import {
  getTelemetrySessionForUser,
  resolveDatasetParquetRelativePath,
} from "@/core/telemetry/telemetry-repo"

function serializeSession(
  row: NonNullable<Awaited<ReturnType<typeof getTelemetrySessionForUser>>>
) {
  const run = row.currentRun
  const errorCode = run?.errorCode ?? null
  const errorDetail = run?.errorDetail ?? null

  const failure =
    row.status === TelemetrySessionStatus.FAILED
      ? {
          code: errorCode?.trim() || "UNKNOWN_FAILURE",
          message: errorCode
            ? telemetryFailureUserMessage(errorCode, errorDetail)
            : telemetryFailureUserMessage(null, errorDetail),
        }
      : undefined

  const datasets = row.datasets.map((d) => {
    const parquetRelativePath =
      run?.status === "SUCCEEDED"
        ? resolveDatasetParquetRelativePath({
            datasetId: d.id,
            qualitySummary: run.qualitySummary,
            outputDatasetIds: run.outputDatasetIds,
          })
        : null

    return {
      id: d.id,
      datasetType: d.datasetType.toLowerCase(),
      sensorType: d.sensorType?.toLowerCase() ?? null,
      sampleRateHz: d.sampleRateHz,
      parquetRelativePath,
    }
  })

  return {
    id: row.id,
    name: row.name,
    status: row.status.toLowerCase(),
    startTimeUtc: row.startTimeUtc.toISOString(),
    endTimeUtc: row.endTimeUtc.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    datasets,
    currentRun: run
      ? {
          id: run.id,
          status: run.status.toLowerCase(),
          pipelineVersion: run.pipelineVersion,
          errorCode: run.errorCode,
          startedAt: run.startedAt?.toISOString() ?? null,
          finishedAt: run.finishedAt?.toISOString() ?? null,
        }
      : null,
    failure,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { sessionId } = await params
    const row = await getTelemetrySessionForUser(sessionId, session.user.id)
    if (!row) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    return successResponse(
      { session: serializeSession(row) },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
