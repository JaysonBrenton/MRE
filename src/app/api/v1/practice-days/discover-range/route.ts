/**
 * @fileoverview Practice day discovery by range API route
 *
 * @description Single-request discovery for a date range (server-side fan-out).
 * Replaces N per-month client requests with one call; reduces payload via summary-only response.
 * Optional stream=true returns NDJSON stream so the client can show partial results as months complete.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  discoverPracticeDays,
  discoverPracticeDaysRange,
  getMonthsBetween,
} from "@/core/practice-days/discover-practice-days"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

const DISCOVER_RANGE_MONTHS_CAP = 12
const DISCOVER_RANGE_CONCURRENCY = 6

function stripSessions(
  practiceDays: Array<{ sessions?: unknown; [k: string]: unknown }>
): Record<string, unknown>[] {
  return practiceDays.map((pd) => {
    const { sessions: _s, ...rest } = pd
    return rest
  })
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized practice day discover-range request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const body = await request.json()
    const { track_id, track_slug, start_date, end_date, stream: wantStream } = body

    if (!track_id) {
      return errorResponse("VALIDATION_ERROR", "track_id is required", {}, 400)
    }
    if (!start_date || typeof start_date !== "string" || !end_date || typeof end_date !== "string") {
      return errorResponse(
        "VALIDATION_ERROR",
        "start_date and end_date are required (ISO date strings)",
        {},
        400
      )
    }

    const startDateStr = start_date.trim()
    const endDateStr = end_date.trim()
    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return errorResponse("VALIDATION_ERROR", "Invalid start_date or end_date", {}, 400)
    }
    if (start > end) {
      return errorResponse("VALIDATION_ERROR", "start_date must be before or equal to end_date", {}, 400)
    }

    const trackSlug =
      typeof track_slug === "string" && track_slug.trim() !== "" ? track_slug.trim() : undefined

    requestLogger.debug("Practice day discover-range request", {
      trackId: track_id,
      trackSlug: trackSlug != null ? "(provided)" : "(will lookup per month)",
      startDate: startDateStr,
      endDate: endDateStr,
      stream: !!wantStream,
    })

    // Streaming: return NDJSON stream so client can show partial results as each month completes
    if (wantStream === true || wantStream === "true") {
      const months = getMonthsBetween(startDateStr, endDateStr)
      const capped =
        months.length > DISCOVER_RANGE_MONTHS_CAP
          ? months.slice(-DISCOVER_RANGE_MONTHS_CAP)
          : months

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let total = 0
            for (let b = 0; b < capped.length; b += DISCOVER_RANGE_CONCURRENCY) {
              if (request.signal?.aborted) break
              const batch = capped.slice(b, b + DISCOVER_RANGE_CONCURRENCY)
              const pending = batch.map(({ year, month }) => ({
                year,
                month,
                promise: discoverPracticeDays({
                  trackId: track_id,
                  year,
                  month,
                  trackSlug,
                  signal: request.signal,
                }),
              }))
              while (pending.length > 0) {
                const { result, year, month } = await Promise.race(
                  pending.map((p) =>
                    p.promise.then((r) => ({ result: r, year: p.year, month: p.month }))
                  )
                )
                const idx = pending.findIndex((p) => p.year === year && p.month === month)
                if (idx !== -1) pending.splice(idx, 1)
                const summary = stripSessions(
                  result.practiceDays as unknown as Array<{ sessions?: unknown; [k: string]: unknown }>
                )
                total += result.practiceDays.length
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: "month", year, month, practice_days: summary }) + "\n")
                )
              }
            }
            controller.enqueue(encoder.encode(JSON.stringify({ type: "done", total }) + "\n"))
          } catch (err) {
            requestLogger.error("Practice day discover-range stream error", {
              error: err instanceof Error ? err.message : String(err),
            })
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "error",
                  message: err instanceof Error ? err.message : "Discovery failed",
                }) + "\n"
              )
            )
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
        },
      })
    }

    const startMs = Date.now()
    const result = await discoverPracticeDaysRange({
      trackId: track_id,
      startDate: startDateStr,
      endDate: endDateStr,
      trackSlug,
      signal: request.signal,
    })
    const durationMs = Date.now() - startMs

    requestLogger.info("Practice day discover-range successful", {
      trackId: track_id,
      practiceDayCount: result.practiceDays.length,
      durationMs,
    })

    const practiceDaysSummary = stripSessions(
      result.practiceDays as unknown as Array<{ sessions?: unknown; [k: string]: unknown }>
    )
    return successResponse({ practice_days: practiceDaysSummary })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
