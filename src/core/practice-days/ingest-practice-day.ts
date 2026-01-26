/**
 * @fileoverview Practice day ingestion core function
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Business logic for practice day ingestion
 */

import type {
  IngestPracticeDayInput,
  IngestPracticeDayResult,
} from "./types"

const INGESTION_SERVICE_URL = process.env.INGESTION_SERVICE_URL || "http://mre-liverc-ingestion-service:8000"

export async function ingestPracticeDay(
  params: IngestPracticeDayInput
): Promise<IngestPracticeDayResult> {
  const response = await fetch(
    `${INGESTION_SERVICE_URL}/api/v1/practice-days/ingest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        track_id: params.trackId,
        date: params.date,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to ingest practice day")
  }

  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.error?.message || "Failed to ingest practice day")
  }

  return data.data
}
