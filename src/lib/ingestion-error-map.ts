/**
 * @fileoverview Maps ingestion service errors to HTTP responses for API routes.
 */

import type { IngestionServiceError } from "./ingestion-client"

const ERROR_STATUS_MAP: Record<string, number> = {
  INGESTION_IN_PROGRESS: 409,
  VALIDATION_ERROR: 400,
  STATE_MACHINE_ERROR: 409,
  NOT_FOUND: 404,
  CONSTRAINT_VIOLATION_ERROR: 409,
  PERSISTENCE_ERROR: 500,
  CONNECTOR_HTTP_ERROR: 502,
  EVENT_PAGE_FORMAT_ERROR: 502,
  RACE_PAGE_FORMAT_ERROR: 502,
  LAP_TABLE_MISSING_ERROR: 502,
  NORMALISATION_ERROR: 502,
  INGESTION_TIMEOUT: 504,
}

const CUSTOM_MESSAGE_MAP: Record<string, string> = {
  INGESTION_IN_PROGRESS:
    "An import is already running for this event. Please wait for it to finish before trying again.",
  INGESTION_TIMEOUT:
    "The ingestion service is taking longer than expected. Please retry in a moment while we finish processing.",
}

export interface IngestionErrorContext {
  eventId?: string
  sourceEventId?: string
  trackId?: string
}

export function toHttpErrorPayload(
  error: IngestionServiceError,
  context: IngestionErrorContext = {}
): { status: number; message: string; details: Record<string, unknown> } {
  const status = ERROR_STATUS_MAP[error.code] ?? 502
  const message = CUSTOM_MESSAGE_MAP[error.code] ?? error.message ?? "Ingestion service error"

  const details: Record<string, unknown> = {
    source: error.source,
    ...error.details,
  }

  if (error.statusCode) {
    details.upstreamStatus = error.statusCode
  }

  if (context.eventId) {
    details.eventId = context.eventId
  }

  if (context.sourceEventId) {
    details.sourceEventId = context.sourceEventId
  }

  if (context.trackId) {
    details.trackId = context.trackId
  }

  return {
    status,
    message,
    details,
  }
}
