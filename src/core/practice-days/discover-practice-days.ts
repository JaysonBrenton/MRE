/**
 * @fileoverview Practice day discovery core function
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Business logic for practice day discovery
 */

import type { DiscoverPracticeDaysInput, DiscoverPracticeDaysResult } from "./types"
import { getTrackById } from "@/core/tracks/repo"

export async function discoverPracticeDays(
  params: DiscoverPracticeDaysInput
): Promise<DiscoverPracticeDaysResult> {
  let trackSlug: string
  if (params.trackSlug != null && params.trackSlug !== "") {
    trackSlug = params.trackSlug
  } else {
    const track = await getTrackById(params.trackId)
    if (!track) {
      throw new Error(`Track not found: ${params.trackId}`)
    }
    trackSlug = track.sourceTrackSlug
  }

  // Read environment variable at runtime (Next.js may not have it at module load time)
  const ingestionServiceUrl =
    process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"

  const url = `${ingestionServiceUrl}/api/v1/practice-days/discover`

  let response: Response
  try {
    const timeoutSignal = AbortSignal.timeout(60000)
    let signal: AbortSignal = timeoutSignal
    if (params.signal) {
      const c = new AbortController()
      const abort = (): void => c.abort()
      timeoutSignal.addEventListener("abort", abort)
      params.signal.addEventListener("abort", abort)
      signal = c.signal
    }

    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        track_slug: trackSlug,
        year: params.year,
        month: params.month,
      }),
      signal,
    })
  } catch (error: unknown) {
    // Handle network errors (connection refused, timeout, etc.)
    const err = error as Error & { cause?: { message?: string; code?: string } }
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      throw new Error(
        `Request to practice day discovery service timed out after 60 seconds. Service URL: ${ingestionServiceUrl}`
      )
    }
    if (err.message === "fetch failed" || err.cause) {
      const causeMsg = err.cause?.message || err.cause?.code || ""
      throw new Error(
        `Failed to connect to practice day discovery service at ${ingestionServiceUrl}. ` +
          `Network error: ${err.message}${causeMsg ? ` (${causeMsg})` : ""}`
      )
    }
    throw error
  }

  if (!response.ok) {
    let errorMessage = "Failed to discover practice days"
    try {
      const error = await response.json()
      // FastAPI 422 validation errors use 'detail' field
      if (error.detail) {
        if (Array.isArray(error.detail)) {
          errorMessage = error.detail
            .map((d: { msg?: string }) => d.msg || JSON.stringify(d))
            .join(", ")
        } else if (typeof error.detail === "string") {
          errorMessage = error.detail
        }
      } else if (error.error?.message) {
        errorMessage = error.error.message
      } else if (error.message) {
        errorMessage = error.message
      }
    } catch {
      errorMessage =
        response.statusText || `HTTP ${response.status}: Failed to discover practice days`
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error?.message || "Failed to discover practice days")
  }

  return {
    practiceDays: data.data.practice_days,
  }
}

/** Max months to request for range discovery (aligns with client default). */
const DISCOVER_RANGE_MONTHS_CAP = 12
/** Concurrency for per-month discovery calls. */
const DISCOVER_RANGE_CONCURRENCY = 6

export interface DiscoverPracticeDaysRangeInput {
  trackId: string
  startDate: string
  endDate: string
  /** When provided, skips getTrackById per month (performance). */
  trackSlug?: string
  signal?: AbortSignal
}

/**
 * Returns list of { year, month } for every month between two ISO date strings (inclusive).
 * Exported for use by streaming route.
 */
export function getMonthsBetween(
  startDateStr: string,
  endDateStr: string
): { year: number; month: number }[] {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  const months: { year: number; month: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endFirst = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= endFirst) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

/**
 * Discover practice days for a date range by calling per-month discovery in parallel chunks.
 * Merges all results and returns a single list. Respects DISCOVER_RANGE_MONTHS_CAP.
 */
export async function discoverPracticeDaysRange(
  params: DiscoverPracticeDaysRangeInput
): Promise<DiscoverPracticeDaysResult> {
  const months = getMonthsBetween(params.startDate, params.endDate)
  const capped =
    months.length > DISCOVER_RANGE_MONTHS_CAP
      ? months.slice(-DISCOVER_RANGE_MONTHS_CAP)
      : months

  const allPracticeDays: Awaited<DiscoverPracticeDaysResult>["practiceDays"] = []

  for (let b = 0; b < capped.length; b += DISCOVER_RANGE_CONCURRENCY) {
    if (params.signal?.aborted) break
    const batch = capped.slice(b, b + DISCOVER_RANGE_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(({ year, month }) =>
        discoverPracticeDays({
          trackId: params.trackId,
          year,
          month,
          trackSlug: params.trackSlug,
          signal: params.signal,
        })
      )
    )
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPracticeDays.push(...result.value.practiceDays)
      }
    }
  }

  return { practiceDays: allPracticeDays }
}
