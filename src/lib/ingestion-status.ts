/**
 * @fileoverview Shared helpers for handling ingestion status fallbacks
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Utility functions that help API routes recover from
 *              transient ingestion errors (timeouts, connection drops)
 *              by polling the database for completion before surfacing
 *              an error to the frontend.
 *
 * @purpose Centralises timeout/connection detection and polling logic so
 *          both API routes and future workers can provide consistent
 *          end-user messaging when the Python ingestion service is still
 *          processing in the background.
 */

export interface EventLikeRecord {
  id: string
  ingestDepth: string | null
  lastIngestedAt: Date | null
}

export interface WaitForCompletionOptions {
  fetchEvent: (eventId: string) => Promise<EventLikeRecord | null>
  eventId: string
  attempts?: number
  delayMs?: number
  targetDepth?: string
}

const DEFAULT_ATTEMPTS = 3
const DEFAULT_DELAY_MS = 2000
const DEFAULT_TARGET_DEPTH = "laps_full"

const TRANSIENT_ERROR_TOKENS = [
  "fetch failed",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "network",
  "timeout",
  "ETIME",
]

/**
 * Determine whether an error represents a transient ingestion failure
 * that is safe to retry/poll for completion.
 */
export function isRecoverableIngestionError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false
  }

  if (error.name === "AbortError") {
    return true
  }

  const normalizedMessage = error.message.toLowerCase()
  return TRANSIENT_ERROR_TOKENS.some((token) => normalizedMessage.includes(token.toLowerCase()))
}

/**
 * Poll the database for an event reaching the desired ingest depth.
 *
 * @returns The event when the required depth is reached, otherwise null
 */
export async function waitForIngestionCompletion({
  fetchEvent,
  eventId,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  targetDepth = DEFAULT_TARGET_DEPTH,
}: WaitForCompletionOptions): Promise<EventLikeRecord | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const event = await fetchEvent(eventId)
    if (event && event.ingestDepth && event.ingestDepth.trim().toLowerCase() === targetDepth) {
      return event
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return null
}
