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

const INGESTION_SERVICE_URL = process.env.INGESTION_SERVICE_URL || "http://ingestion-service:8000";

export interface IngestEventRequest {
  depth: "laps_full" | "none";
}

export interface IngestEventResponse {
  event_id: string;
  ingest_depth: string;
  last_ingested_at?: string;
  races_ingested: number;
  results_ingested: number;
  laps_ingested: number;
  status: "updated" | "already_complete" | "in_progress";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isIngestionSuccessResponse(value: unknown): value is IngestionSuccessResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    "data" in value
  )
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
  source: string;
  source_event_id: string;
  track_slug: string;
  event_name: string;
  event_date: string; // ISO string
  event_entries: number;
  event_drivers: number;
  event_url: string;
}

export interface DiscoveryResponse {
  success: true;
  data: {
    events: DiscoveredEvent[];
  };
}

export interface DiscoveryErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
    source: string;
  };
}

export interface IngestionSuccessResponse {
  success: true;
  data: IngestEventResponse;
}

export interface IngestionErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
    source: string;
  };
}

export interface EntryListDriver {
  driver_name: string;
  car_number: string | null;
  transponder_number: string | null;
  source_driver_id: string | null;
  class_name: string;
}

export interface EntryListResponse {
  success: true;
  data: {
    source_event_id: string;
    entries_by_class: Record<string, EntryListDriver[]>;
  };
}

export interface EntryListErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
    source: string;
  };
}

export class IngestionClient {
  private baseUrl: string;

  constructor(baseUrl: string = INGESTION_SERVICE_URL) {
    this.baseUrl = baseUrl;
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
      throw new Error("Ingestion service returned an unexpected response format")
    }

    return payload.data
  }

  private async performIngestionRequest(
    url: string,
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<IngestEventResponse> {
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
          throw new IngestionServiceError(payload.error, response.status)
        }
        throw new Error(`Ingestion request failed with HTTP ${response.status}: ${response.statusText}`)
      }

      return this.assertIngestionSuccess(payload, response.status)
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Ingestion timeout: The import is taking longer than expected. Please check back later - the import may still be processing in the background."
          )
        }

        if (
          error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND")
        ) {
          throw new Error("Cannot connect to ingestion service. Please ensure the ingestion service is running.")
        }
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async discoverEvents(
    trackSlug: string,
    startDate?: string,
    endDate?: string
  ): Promise<DiscoveredEvent[]> {
    assertScrapingEnabled()
    const url = `${this.baseUrl}/api/v1/events/discover`;
    
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
    
    // Use AbortController for timeout (5 minutes for discovery - LiveRC can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response is OK before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          // If JSON parsing fails, use status text
        }
        throw new Error(`Discovery failed: ${errorMessage}`);
      }

      const json: DiscoveryResponse | DiscoveryErrorResponse = await response.json();

      if (!json.success) {
        const error = json.error;
        throw new Error(`Discovery failed: ${error.message}`);
      }

      return json.data.events;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Discovery timeout: The LiveRC discovery is taking longer than expected. The ingestion service may be busy processing other requests. Please try again in a few moments.");
        }
        // Handle network errors
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
          throw new Error("Cannot connect to ingestion service. Please ensure the ingestion service is running.");
        }
      }
      throw error;
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
          throw new Error("Entry list fetch timeout: The LiveRC entry list fetch is taking longer than expected. Please try again in a few moments.")
        }
        // Handle network errors
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
          throw new Error("Cannot connect to ingestion service. Please ensure the ingestion service is running.")
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
    return this.performIngestionRequest(
      url,
      { depth },
      10 * 60 * 1000,
    )
  }

  async ingestEventBySourceId(
    sourceEventId: string,
    trackId: string,
    depth: "laps_full" | "none" = "laps_full"
  ): Promise<IngestEventResponse> {
    const url = `${this.baseUrl}/api/v1/events/ingest`
    return this.performIngestionRequest(
      url,
      {
        source_event_id: sourceEventId,
        track_id: trackId,
        depth,
      },
      10 * 60 * 1000,
    )
  }

  async getIngestionStatus(eventId: string): Promise<{
    event_id: string;
    ingest_depth: string;
    last_ingested_at: string | null;
  }> {
    const url = `${this.baseUrl}/api/v1/ingestion/status/${eventId}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get ingestion status: ${response.statusText}`);
    }

    return response.json();
  }
}

export const ingestionClient = new IngestionClient();
