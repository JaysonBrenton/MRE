// @fileoverview HTTP client for Python ingestion service
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description TypeScript client for calling Python ingestion service
//
// @purpose Provides typed HTTP client to interact with Python ingestion
//          microservice API endpoints

import { assertScrapingEnabled } from "./site-policy"

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL || "http://liverc-ingestion-service:8000"

export interface IngestEventRequest {
  depth: "laps_full" | "none"
}

export interface IngestEventResponse {
  event_id: string
  ingest_depth: string
  last_ingested_at?: string
  races_ingested: number
  results_ingested: number
  laps_ingested: number
  status: "updated" | "already_complete" | "in_progress"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isIngestionSuccessResponse(value: unknown): value is IngestionSuccessResponse {
  return isRecord(value) && value.success === true && "data" in value
}

function isIngestionErrorResponse(value: unknown): value is IngestionErrorResponse {
  return (
    isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string"
  )
}

export class IngestionServiceError extends Error {
  readonly code: string
  readonly source: string
  readonly details: Record<string, unknown>
  readonly statusCode: number

  constructor(
    error: {
      code?: string
      source?: string
      message?: string
      details?: unknown
    },
    statusCode: number
  ) {
    const message = error?.message || "Ingestion service error"
    super(message)
    this.name = "IngestionServiceError"
    this.code = error?.code || "INGESTION_ERROR"
    this.source = error?.source || "ingestion_service"
    this.statusCode = statusCode
    if (isRecord(error?.details)) {
      this.details = { ...error.details }
    } else if (error?.details !== undefined) {
      this.details = { value: error.details }
    } else {
      this.details = {}
    }
  }
}

export interface DiscoveredEvent {
  source: string
  source_event_id: string
  track_slug: string
  event_name: string
  event_date: string // ISO string
  event_entries: number
  event_drivers: number
  event_url: string
}

export interface DiscoveryResponse {
  success: true
  data: {
    events: DiscoveredEvent[]
  }
}

export interface DiscoveryErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details: unknown
    source: string
  }
}

export interface IngestionSuccessResponse {
  success: true
  data: IngestEventResponse
}

export interface IngestionErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details: unknown
    source: string
  }
}

export interface EntryListDriver {
  driver_name: string
  car_number: string | null
  transponder_number: string | null
  source_driver_id: string | null
  class_name: string
}

export interface EntryListResponse {
  success: true
  data: {
    source_event_id: string
    entries_by_class: Record<string, EntryListDriver[]>
  }
}

export interface EntryListErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details: unknown
    source: string
  }
}

/**
 * Circuit breaker for ingestion service calls
 * Prevents cascading failures by failing fast when service is down
 */
class CircuitBreaker {
  private failures: number = 0
  private lastFailureTime: number = 0
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED"

  // Configuration
  private readonly failureThreshold: number = 3 // Open circuit after 3 failures
  private readonly timeoutMs: number = 60000 // 60 seconds before trying half-open
  private readonly successThreshold: number = 1 // Close circuit after 1 success in half-open

  /**
   * Check if circuit is open (should fail fast)
   */
  isOpen(): boolean {
    if (this.state === "OPEN") {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      if (timeSinceLastFailure >= this.timeoutMs) {
        // Transition to half-open to test if service recovered
        this.state = "HALF_OPEN"
        return false
      }
      return true
    }
    return false
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      // Service recovered - close circuit
      this.state = "CLOSED"
      this.failures = 0
    } else if (this.state === "CLOSED") {
      // Reset failure count on success
      this.failures = 0
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now()
    this.failures++

    if (this.state === "HALF_OPEN") {
      // Still failing - open circuit again
      this.state = "OPEN"
      this.failures = this.failureThreshold
    } else if (this.failures >= this.failureThreshold) {
      // Too many failures - open circuit
      this.state = "OPEN"
    }
  }

  /**
   * Get current circuit state for monitoring
   */
  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    }
  }

  /**
   * Reset circuit breaker (for testing/recovery)
   */
  reset(): void {
    this.state = "CLOSED"
    this.failures = 0
    this.lastFailureTime = 0
  }
}

export class IngestionClient {
  private baseUrl: string
  private circuitBreaker: CircuitBreaker

  constructor(baseUrl: string = INGESTION_SERVICE_URL) {
    this.baseUrl = baseUrl
    this.circuitBreaker = new CircuitBreaker()
  }

  private async parseJsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  private assertIngestionSuccess(payload: unknown, status: number): IngestEventResponse {
    if (isIngestionErrorResponse(payload)) {
      throw new IngestionServiceError(payload.error, status)
    }

    if (!isIngestionSuccessResponse(payload)) {
      // Try to extract error information from the unexpected payload
      let errorMessage = "Ingestion service returned an unexpected response format"
      const errorDetails: Record<string, unknown> = { payload: payload ?? null }

      if (payload && typeof payload === "object" && payload !== null) {
        const payloadObj = payload as Record<string, unknown>

        // Check for error information in various formats
        if (typeof payloadObj.error === "string") {
          errorMessage = payloadObj.error as string
        } else if (typeof payloadObj.message === "string") {
          errorMessage = payloadObj.message as string
        } else if (typeof payloadObj.detail === "string") {
          errorMessage = payloadObj.detail as string
        } else if (typeof payloadObj.error_type === "string") {
          const errorType = payloadObj.error_type as string
          errorMessage = `Ingestion service error: ${errorType}`
          if (typeof payloadObj.error === "string") {
            errorMessage = payloadObj.error as string
          }
        }
      }

      throw new IngestionServiceError(
        {
          code: "INGESTION_ERROR",
          message: errorMessage,
          source: "ingestion_client",
          details: errorDetails,
        },
        status
      )
    }

    return payload.data
  }

  private async performIngestionRequest(
    url: string,
    body: Record<string, unknown>,
    timeoutMs: number,
    maxRetries: number = 3
  ): Promise<IngestEventResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        const payload = await this.parseJsonResponse(response)

        if (!response.ok) {
          if (payload && isIngestionErrorResponse(payload)) {
            // Extract error details, including any nested error information
            const errorData = payload.error
            const errorDetails: Record<string, unknown> = {}

            // Preserve all error details
            if (typeof errorData === "object" && errorData !== null) {
              Object.assign(errorDetails, errorData)
            }

            throw new IngestionServiceError(
              {
                code: errorData.code,
                message: errorData.message,
                source: errorData.source,
                details: {
                  ...errorDetails,
                  ...(typeof errorData.details === "object" && errorData.details !== null
                    ? errorData.details
                    : {}),
                },
              },
              response.status
            )
          }
          // Try to extract error details from non-standard error response
          let errorMessage = `Ingestion request failed with HTTP ${response.status}: ${response.statusText}`
          let errorCode = "INGESTION_ERROR"
          const errorDetails: Record<string, unknown> = {}

          if (payload && typeof payload === "object" && payload !== null) {
            const errorObj = payload as Record<string, unknown>

            // Try to extract message from various possible locations
            if (typeof errorObj.message === "string") {
              errorMessage = errorObj.message
            } else if (typeof errorObj.error === "object" && errorObj.error !== null) {
              const innerError = errorObj.error as Record<string, unknown>
              if (typeof innerError.message === "string") {
                errorMessage = innerError.message
              }
              if (typeof innerError.code === "string") {
                errorCode = innerError.code
              }
            } else if (typeof errorObj.detail === "string") {
              // FastAPI often puts error details in 'detail' field
              errorMessage = errorObj.detail
            } else if (typeof errorObj.error_type === "string") {
              // Handle Python error types (e.g., AttributeError, ValueError)
              const errorType = errorObj.error_type as string
              errorMessage = `Ingestion service error: ${errorType}`
              if (typeof errorObj.error === "string") {
                errorMessage = errorObj.error as string
              }
            }

            // Preserve all error details for debugging
            Object.assign(errorDetails, payload)
          }

          throw new IngestionServiceError(
            {
              code: errorCode,
              message: errorMessage,
              source: "ingestion_service",
              details: errorDetails,
            },
            response.status
          )
        }

        // Success - clear timeout and return
        clearTimeout(timeoutId)
        return this.assertIngestionSuccess(payload, response.status)
      } catch (error: unknown) {
        clearTimeout(timeoutId)

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            throw new Error(
              "Ingestion timeout: The import is taking longer than expected. Please check back later - the import may still be processing in the background."
            )
          }

          // Check for various connection error patterns
          const isConnectionError =
            error.message.includes("fetch failed") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND") ||
            error.message.includes("getaddrinfo") ||
            error.message.includes("EAI_AGAIN") ||
            error.message.includes("network") ||
            error.message.includes("socket") ||
            (error.cause instanceof Error &&
              (error.cause.message.includes("ECONNREFUSED") ||
                error.cause.message.includes("ENOTFOUND") ||
                error.cause.message.includes("getaddrinfo")))

          if (isConnectionError) {
            lastError = error

            // If we have retries left, wait and retry
            if (attempt < maxRetries) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000) // Exponential backoff: 1s, 2s, 4s, max 5s
              console.warn(
                `[IngestionClient] Connection error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`,
                {
                  url,
                  errorMessage: error.message,
                  attempt: attempt + 1,
                  maxRetries: maxRetries + 1,
                }
              )

              await new Promise((resolve) => setTimeout(resolve, backoffMs))
              continue // Retry the request
            }

            // No retries left - throw error with details
            const errorDetails = {
              url,
              baseUrl: this.baseUrl,
              errorName: error.name,
              errorMessage: error.message,
              errorCause:
                error.cause instanceof Error ? error.cause.message : String(error.cause || "none"),
              attempts: attempt + 1,
            }
            console.error("[IngestionClient] Connection error after retries:", errorDetails)
            throw new Error(
              `Cannot connect to ingestion service at ${url} after ${attempt + 1} attempts. Please ensure the ingestion service is running. Error: ${error.message}`
            )
          }
        }

        // Not a connection error or retries exhausted - throw immediately
        throw error
      }
    }

    // This should never be reached, but TypeScript needs it
    if (lastError) {
      throw lastError
    }
    throw new Error("Unexpected error in performIngestionRequest")
  }

  async discoverEvents(
    trackSlug: string,
    startDate?: string,
    endDate?: string
  ): Promise<DiscoveredEvent[]> {
    assertScrapingEnabled()

    // Check circuit breaker - fail fast if circuit is open
    if (this.circuitBreaker.isOpen()) {
      const state = this.circuitBreaker.getState()
      throw new Error(
        `LiveRC discovery service is currently unavailable (circuit open). ` +
          `The service has experienced repeated failures. Please try again in a moment. ` +
          `Last failure: ${new Date(state.lastFailureTime).toLocaleTimeString()}`
      )
    }

    const url = `${this.baseUrl}/api/v1/events/discover`

    // Build request body - only include dates if provided
    const requestBody: {
      track_slug: string
      start_date?: string
      end_date?: string
    } = {
      track_slug: trackSlug,
    }

    if (startDate) {
      requestBody.start_date = startDate
    }

    if (endDate) {
      requestBody.end_date = endDate
    }

    // Increased timeout to 120 seconds (2 minutes) for web scraping operations
    // LiveRC discovery involves web scraping which can be slow, especially
    // for tracks with many events. The backend has a 5 minute timeout, but
    // we use a shorter client timeout to provide better UX feedback.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120 * 1000) // 120 seconds (2 minutes)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check if response is OK before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorJson = await response.json()
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message
          } else if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch {
          // If JSON parsing fails, use status text
        }

        // Record failure in circuit breaker
        this.circuitBreaker.recordFailure()
        throw new Error(`Discovery failed: ${errorMessage}`)
      }

      const json: DiscoveryResponse | DiscoveryErrorResponse = await response.json()

      if (!json.success) {
        const error = json.error
        // Record failure in circuit breaker
        this.circuitBreaker.recordFailure()
        throw new Error(`Discovery failed: ${error.message}`)
      }

      // Record success in circuit breaker
      this.circuitBreaker.recordSuccess()
      return json.data.events
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          // Timeout - record failure
          this.circuitBreaker.recordFailure()
          throw new Error(
            "Discovery timeout: The LiveRC discovery is taking longer than expected (over 2 minutes). The ingestion service may be busy processing other requests or the track may have many events. Please try again in a few moments."
          )
        }
        // Handle network errors with improved diagnostics
        const isConnectionError =
          error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("getaddrinfo") ||
          error.message.includes("EAI_AGAIN") ||
          error.message.includes("network") ||
          error.message.includes("socket") ||
          error.message.includes("Failed to fetch") ||
          (error.cause instanceof Error &&
            (error.cause.message.includes("ECONNREFUSED") ||
              error.cause.message.includes("ENOTFOUND") ||
              error.cause.message.includes("getaddrinfo")))
        if (isConnectionError) {
          // Record failure in circuit breaker
          this.circuitBreaker.recordFailure()
          console.error("[IngestionClient] Discovery connection error:", {
            url,
            baseUrl: this.baseUrl,
            errorName: error.name,
            errorMessage: error.message,
            errorCause:
              error.cause instanceof Error ? error.cause.message : String(error.cause || "none"),
            circuitState: this.circuitBreaker.getState(),
            trackSlug,
          })
          // Provide more helpful error message with troubleshooting steps
          throw new Error(
            `Cannot connect to ingestion service at ${url}. ` +
            `Please ensure the ingestion service is running. ` +
            `You can check the service status with: docker ps | grep liverc-ingestion-service ` +
            `or restart it with: docker compose restart liverc-ingestion-service. ` +
            `Error: ${error.message}`
          )
        }
      }
      // Record failure for any other error
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  async getEventEntryList(
    trackSlug: string,
    sourceEventId: string
  ): Promise<EntryListResponse["data"]> {
    assertScrapingEnabled()
    const url = `${this.baseUrl}/api/v1/events/entry-list`

    // Use AbortController for timeout (2 minutes for entry list fetch)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000) // 2 minutes

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          track_slug: trackSlug,
          source_event_id: sourceEventId,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check if response is OK before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorJson = await response.json()
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message
          } else if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch {
          // If JSON parsing fails, use status text
        }
        throw new Error(`Entry list fetch failed: ${errorMessage}`)
      }

      const json: EntryListResponse | EntryListErrorResponse = await response.json()

      if (!json.success) {
        const error = json.error
        throw new Error(`Entry list fetch failed: ${error.message}`)
      }

      return json.data
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Entry list fetch timeout: The LiveRC entry list fetch is taking longer than expected. Please try again in a few moments."
          )
        }
        // Handle network errors
        const isConnectionError =
          error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("getaddrinfo") ||
          error.message.includes("EAI_AGAIN") ||
          error.message.includes("network") ||
          error.message.includes("socket") ||
          (error.cause instanceof Error &&
            (error.cause.message.includes("ECONNREFUSED") ||
              error.cause.message.includes("ENOTFOUND") ||
              error.cause.message.includes("getaddrinfo")))
        if (isConnectionError) {
          console.error("[IngestionClient] Entry list connection error:", {
            url,
            errorName: error.name,
            errorMessage: error.message,
            errorCause:
              error.cause instanceof Error ? error.cause.message : String(error.cause || "none"),
          })
          throw new Error(
            `Cannot connect to ingestion service at ${url}. Please ensure the ingestion service is running. Error: ${error.message}`
          )
        }
      }
      throw error
    }
  }

  async ingestEvent(
    eventId: string,
    depth: "laps_full" | "none" = "laps_full"
  ): Promise<IngestEventResponse> {
    assertScrapingEnabled()
    const url = `${this.baseUrl}/api/v1/events/${eventId}/ingest`
    return this.performIngestionRequest(url, { depth }, 10 * 60 * 1000)
  }

  async ingestEventBySourceId(
    sourceEventId: string,
    trackId: string,
    depth: "laps_full" | "none" = "laps_full"
  ): Promise<IngestEventResponse> {
    assertScrapingEnabled()
    const url = `${this.baseUrl}/api/v1/events/ingest`
    return this.performIngestionRequest(
      url,
      {
        source_event_id: sourceEventId,
        track_id: trackId,
        depth,
      },
      10 * 60 * 1000
    )
  }

  async getIngestionStatus(eventId: string): Promise<{
    event_id: string
    ingest_depth: string
    last_ingested_at: string | null
  }> {
    const url = `${this.baseUrl}/api/v1/ingestion/status/${eventId}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to get ingestion status: ${response.statusText}`)
    }

    return response.json()
  }
}

export const ingestionClient = new IngestionClient()
