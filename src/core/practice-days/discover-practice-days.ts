/**
 * @fileoverview Practice day discovery core function
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Business logic for practice day discovery
 */

import type {
  DiscoverPracticeDaysInput,
  DiscoverPracticeDaysResult,
} from "./types"
import { getTrackById } from "@/core/tracks/repo"

export async function discoverPracticeDays(
  params: DiscoverPracticeDaysInput
): Promise<DiscoverPracticeDaysResult> {
  // Get track to retrieve track_slug
  const track = await getTrackById(params.trackId)
  if (!track) {
    throw new Error(`Track not found: ${params.trackId}`)
  }
  
  // Read environment variable at runtime (Next.js may not have it at module load time)
  const ingestionServiceUrl = process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"
  
  const url = `${ingestionServiceUrl}/api/v1/practice-days/discover`
  
  let response: Response
  try {
    response = await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          track_slug: track.sourceTrackSlug,
          year: params.year,
          month: params.month,
        }),
        // Add timeout signal (60 seconds for practice day discovery)
        signal: AbortSignal.timeout(60000),
      }
    )
  } catch (error: any) {
    // Handle network errors (connection refused, timeout, etc.)
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new Error(`Request to practice day discovery service timed out after 60 seconds. Service URL: ${ingestionServiceUrl}`)
    }
    if (error.message === "fetch failed" || error.cause) {
      const causeMsg = error.cause?.message || error.cause?.code || ""
      throw new Error(
        `Failed to connect to practice day discovery service at ${ingestionServiceUrl}. ` +
        `Network error: ${error.message}${causeMsg ? ` (${causeMsg})` : ""}`
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
          errorMessage = error.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
        } else if (typeof error.detail === "string") {
          errorMessage = error.detail
        }
      } else if (error.error?.message) {
        errorMessage = error.error.message
      } else if (error.message) {
        errorMessage = error.message
      }
    } catch (e) {
      errorMessage = response.statusText || `HTTP ${response.status}: Failed to discover practice days`
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
