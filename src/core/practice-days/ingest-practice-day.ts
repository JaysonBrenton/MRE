/**
 * @fileoverview Practice day ingestion core function
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Business logic for practice day ingestion
 */

import type { IngestPracticeDayInput, IngestPracticeDayResult } from "./types"

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL || "http://mre-liverc-ingestion-service:8000"

export async function ingestPracticeDay(
  params: IngestPracticeDayInput
): Promise<IngestPracticeDayResult> {
  const response = await fetch(`${INGESTION_SERVICE_URL}/api/v1/practice-days/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      track_id: params.trackId,
      date: params.date,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Failed to ingest practice day")
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error?.message || "Failed to ingest practice day")
  }

  const payload = data.data as Record<string, unknown>
  return {
    eventId: payload.event_id as string,
    sessionsIngested: payload.sessions_ingested as number,
    sessionsFailed: payload.sessions_failed as number,
    status: payload.status as string,
    ...(payload.sessions_with_laps !== undefined && { sessionsWithLaps: payload.sessions_with_laps as number }),
    ...(payload.laps_ingested !== undefined && { lapsIngested: payload.laps_ingested as number }),
    ...(payload.sessions_detail_failed !== undefined && { sessionsDetailFailed: payload.sessions_detail_failed as number }),
  }
}
