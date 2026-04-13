/**
 * GET/PATCH/DELETE /api/v1/telemetry/sessions/{sessionId}
 */

import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { telemetryFailureUserMessage } from "@/core/telemetry/telemetry-failure-messages"
import {
  buildSessionEtag,
  deleteTelemetrySessionForUser,
  getTelemetrySessionForUser,
  resolveDatasetParquetRelativePath,
  updateTelemetrySessionForUser,
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

  const datasets = row.datasets
    .filter((d) => (row.currentRunId ? d.runId === row.currentRunId : false))
    .map((d) => {
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

  const runId = row.currentRun?.id
  const laps = row.laps
    .filter((l) => (runId ? l.runId === runId : true))
    .map((l) => ({
      lapNumber: l.lapNumber,
      startTimeUtc: l.startTimeUtc.toISOString(),
      endTimeUtc: l.endTimeUtc.toISOString(),
      durationMs: l.durationMs,
      validity: l.validity.toLowerCase(),
    }))

  const qs = run?.qualitySummary
  const q = qs && typeof qs === "object" && qs !== null ? (qs as Record<string, unknown>) : null
  const segments = Array.isArray(q?.segments) ? q.segments : []

  return {
    id: row.id,
    name: row.name,
    shareEnabled: Boolean(row.shareToken),
    trackId: row.trackId,
    track: row.track
      ? {
          id: row.track.id,
          trackName: row.track.trackName,
          hasStartFinishLine: row.track.startFinishLineGeoJson != null,
        }
      : null,
    livercEventId: row.livercEventId,
    livercRaceId: row.livercRaceId,
    userSflLineGeoJson: row.userSflLineGeoJson,
    status: row.status.toLowerCase(),
    startTimeUtc: row.startTimeUtc.toISOString(),
    endTimeUtc: row.endTimeUtc.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    datasets,
    laps,
    segments,
    currentRun: run
      ? {
          id: run.id,
          status: run.status.toLowerCase(),
          pipelineVersion: run.pipelineVersion,
          canonicaliserVersion: run.canonicaliserVersion,
          fusionVersion: run.fusionVersion,
          lapDetectorVersion: run.lapDetectorVersion,
          errorCode: run.errorCode,
          startedAt: run.startedAt?.toISOString() ?? null,
          finishedAt: run.finishedAt?.toISOString() ?? null,
        }
      : null,
    failure,
  }
}

export async function GET(
  request: NextRequest,
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

    const etag = buildSessionEtag(row.updatedAt, row.id)
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } })
    }

    return NextResponse.json(
      { success: true as const, data: { session: serializeSession(row) } },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_CONTROL.NO_CACHE,
          ETag: etag,
        },
      }
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { sessionId } = await params
    let body: {
      name?: unknown
      livercEventId?: unknown
      livercRaceId?: unknown
      trackId?: unknown
      userSflLineGeoJson?: unknown
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }

    const patch: {
      name?: string | null
      livercEventId?: string | null
      livercRaceId?: string | null
      trackId?: string | null
      userSflLineGeoJson?: unknown | null
    } = {}
    if (body.name !== undefined) {
      patch.name = typeof body.name === "string" ? body.name : null
    }
    if (body.livercEventId !== undefined) {
      patch.livercEventId =
        typeof body.livercEventId === "string" && body.livercEventId.trim()
          ? body.livercEventId.trim()
          : null
    }
    if (body.livercRaceId !== undefined) {
      patch.livercRaceId =
        typeof body.livercRaceId === "string" && body.livercRaceId.trim()
          ? body.livercRaceId.trim()
          : null
    }
    if (body.userSflLineGeoJson !== undefined) {
      patch.userSflLineGeoJson =
        body.userSflLineGeoJson === null ? null : (body.userSflLineGeoJson as object)
    }
    if (body.trackId !== undefined) {
      if (body.trackId === null || body.trackId === "") {
        patch.trackId = null
      } else if (typeof body.trackId === "string" && body.trackId.trim()) {
        patch.trackId = body.trackId.trim()
      }
    }

    const result = await updateTelemetrySessionForUser(session.user.id, sessionId, patch)
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
      }
      if (result.code === "BAD_TRACK") {
        return errorResponse("VALIDATION_ERROR", "Unknown or inactive track", undefined, 400)
      }
      return errorResponse("VALIDATION_ERROR", "Invalid LiveRC link reference", undefined, 400)
    }

    const row = await getTelemetrySessionForUser(sessionId, session.user.id)
    if (!row) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    const etag = buildSessionEtag(row.updatedAt, row.id)
    return NextResponse.json(
      { success: true as const, data: { session: serializeSession(row) } },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_CONTROL.NO_CACHE,
          ETag: etag,
        },
      }
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function DELETE(
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
    const result = await deleteTelemetrySessionForUser(session.user.id, sessionId)
    if (!result.ok) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    return successResponse({ deleted: true }, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
