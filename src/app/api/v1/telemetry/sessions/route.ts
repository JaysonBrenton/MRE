/**
 * GET /api/v1/telemetry/sessions — list telemetry sessions for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import {
  decodeTelemetryListCursor,
  listTelemetrySessionsForUser,
} from "@/core/telemetry/telemetry-repo"

function parseStatus(raw: string | null): TelemetrySessionStatus | undefined {
  if (!raw) return undefined
  const u = raw.toUpperCase().replace(/-/g, "_")
  if (u in TelemetrySessionStatus) {
    return TelemetrySessionStatus[u as keyof typeof TelemetrySessionStatus]
  }
  return undefined
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { searchParams } = new URL(request.url)
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50
    if (Number.isNaN(limit)) {
      return errorResponse("VALIDATION_ERROR", "Invalid limit", undefined, 400)
    }

    const cursor = decodeTelemetryListCursor(searchParams.get("cursor"))
    if (searchParams.get("cursor") && !cursor) {
      return errorResponse("VALIDATION_ERROR", "Invalid cursor", undefined, 400)
    }

    const status = parseStatus(searchParams.get("status"))

    const { items, nextCursor } = await listTelemetrySessionsForUser(session.user.id, {
      limit,
      cursor,
      status,
    })

    const etag = weakEtagFromParts([
      session.user.id,
      String(limit),
      searchParams.get("cursor") ?? "",
      status ?? "",
      nextCursor ?? "",
      items.map((r) => `${r.id}:${r.updatedAt.getTime()}`).join(","),
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    const payload = {
      items: items.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status.toLowerCase(),
        startTimeUtc: row.startTimeUtc.toISOString(),
        endTimeUtc: row.endTimeUtc.toISOString(),
        createdAt: row.createdAt.toISOString(),
        summary: {
          datasetCount: row._count.datasets,
          // MVP pipeline only creates CANON_GNSS datasets
          hasGnss: row._count.datasets > 0,
        },
      })),
      nextCursor,
    }

    return successResponse(payload, 200, undefined, CACHE_CONTROL.NO_CACHE, { ETag: etag })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
