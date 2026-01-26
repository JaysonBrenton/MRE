/**
 * @fileoverview Practice day search core function
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Business logic for searching practice days in database
 */

import type {
  SearchPracticeDaysInput,
  SearchPracticeDaysResult,
} from "./types"

const INGESTION_SERVICE_URL = process.env.INGESTION_SERVICE_URL || "http://mre-liverc-ingestion-service:8000"

export async function searchPracticeDays(
  params: SearchPracticeDaysInput
): Promise<SearchPracticeDaysResult> {
  const queryParams = new URLSearchParams({
    track_id: params.trackId,
  })
  
  if (params.startDate) {
    queryParams.append("start_date", params.startDate)
  }
  if (params.endDate) {
    queryParams.append("end_date", params.endDate)
  }

  const response = await fetch(
    `${INGESTION_SERVICE_URL}/api/v1/practice-days/search?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to search practice days")
  }

  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.error?.message || "Failed to search practice days")
  }

  return {
    practiceDays: data.data.practice_days,
  }
}
