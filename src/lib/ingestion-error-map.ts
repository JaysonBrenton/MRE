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
  INGESTION_ERROR: 502,
  INTERNAL_ERROR: 502,
}

const CUSTOM_MESSAGE_MAP: Record<string, string> = {
  INGESTION_IN_PROGRESS:
    "An import is already running for this event. Please wait for it to finish before trying again.",
  INGESTION_TIMEOUT:
    "The ingestion service is taking longer than expected. Please retry in a moment while we finish processing.",
  INTERNAL_ERROR:
    "The ingestion service encountered an internal error. Please try again later or contact support if the issue persists.",
  INGESTION_ERROR:
    "An error occurred while importing the event. Please try again or contact support if the issue persists.",
  VALIDATION_ERROR:
    "Validation error during import. Please check the event details and try again.",
}

// Check if error message indicates empty entry list
function isEmptyEntryListError(message: string): boolean {
  return message.toLowerCase().includes("entry list is empty")
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
  // Use custom message if available, otherwise use error.message if it's informative,
  // otherwise fall back to default message for the code
  let message = CUSTOM_MESSAGE_MAP[error.code]
  
  // Special handling for empty entry list errors - use the detailed message from the pipeline
  if (error.code === "VALIDATION_ERROR" && isEmptyEntryListError(error.message)) {
    message = error.message
  } else if (!message) {
    // Only use error.message if it's not a generic/default message
    if (error.message && 
        error.message !== "Internal server error" && 
        error.message !== "Ingestion service error" &&
        error.message.length > 0) {
      message = error.message
    } else {
      message = "Ingestion service error"
    }
  }

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
