/**
 * GET /api/v1/telemetry/sessions/{sessionId}/export — stream canonical GNSS Parquet bytes.
 */

import { readFile, stat } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import {
  getTelemetrySessionForUser,
  resolvePrimaryGnssParquetPath,
} from "@/core/telemetry/telemetry-repo"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import { absolutePathFromStoragePath } from "@/core/telemetry/telemetry-upload-storage"

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
    const format = request.nextUrl.searchParams.get("format")?.trim().toLowerCase()
    if (format === "arrow" || format === "ipc") {
      return errorResponse(
        "NOT_IMPLEMENTED",
        "Apache Arrow IPC export is not implemented; use format=parquet (default)",
        undefined,
        501
      )
    }

    const row = await getTelemetrySessionForUser(sessionId, session.user.id)
    if (!row) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    if (row.status !== TelemetrySessionStatus.READY) {
      return errorResponse("NOT_READY", "Session is not ready for export", undefined, 409)
    }

    const rel = resolvePrimaryGnssParquetPath(row)
    if (!rel) {
      return errorResponse("NOT_FOUND", "No canonical GNSS file for this session", undefined, 404)
    }

    const abs = absolutePathFromStoragePath(rel)
    const st = await stat(abs)
    const etag = weakEtagFromParts([
      sessionId,
      row.updatedAt.toISOString(),
      rel,
      st.size,
      st.mtimeMs,
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    const buf = await readFile(abs)

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apache.parquet",
        "Content-Disposition": `attachment; filename="telemetry-${sessionId}-gnss_pvt.parquet"`,
        "Cache-Control": CACHE_CONTROL.NO_CACHE,
        ETag: etag,
      },
    })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
