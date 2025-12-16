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
  status: "updated" | "already_complete";
}

export interface IngestionError {
  error: {
    code: string;
    source: string;
    message: string;
    details: Record<string, unknown>;
  };
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

export class IngestionClient {
  private baseUrl: string;

  constructor(baseUrl: string = INGESTION_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  async discoverEvents(
    trackSlug: string,
    startDate?: string,
    endDate?: string
  ): Promise<DiscoveredEvent[]> {
    const url = `${this.baseUrl}/api/v1/events/discover`;
    
    // Build request body - only include dates if provided
    const requestBody: any = {
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

  async ingestEvent(
    eventId: string,
    depth: "laps_full" = "laps_full"
  ): Promise<IngestEventResponse> {
    const url = `${this.baseUrl}/api/v1/events/${eventId}/ingest`;
    
    // Use AbortController for timeout (10 minutes for large events)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ depth }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // Check if response is OK before parsing
      if (!response.ok) {
        // Try to parse error response
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
        throw new Error(`Ingestion failed: ${errorMessage}`);
      }
      
      const json: IngestionSuccessResponse | IngestionErrorResponse = await response.json();

      if (!json.success) {
        const error = json.error;
        throw new Error(`Ingestion failed: ${error.message}`);
      }

      return json.data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Ingestion timeout: The import is taking longer than expected. Please check back later - the import may still be processing in the background.");
        }
        // Handle network errors
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
          throw new Error("Cannot connect to ingestion service. Please ensure the ingestion service is running.");
        }
      }
      throw error;
    }
  }

  async ingestEventBySourceId(
    sourceEventId: string,
    trackId: string,
    depth: "laps_full" = "laps_full"
  ): Promise<IngestEventResponse> {
    const url = `${this.baseUrl}/api/v1/events/ingest`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:191',message:'Ingestion client - starting fetch',data:{url,sourceEventId,trackId,depth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Use AbortController for timeout (10 minutes for large events)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_event_id: sourceEventId,
          track_id: trackId,
          depth,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:214',message:'Ingestion service response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Check if response is OK before parsing
      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:222',message:'Ingestion service error response',data:{status:response.status,errorJson},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch {
          // If JSON parsing fails, use status text
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:230',message:'Failed to parse error JSON',data:{status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
        throw new Error(`Ingestion failed: ${errorMessage}`);
      }
      
      const json: IngestionSuccessResponse | IngestionErrorResponse = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:236',message:'Ingestion service JSON parsed',data:{success:json.success,hasError:!json.success,errorMessage:!json.success?json.error?.message:undefined,responseData:json.success?json.data:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (!json.success) {
        const error = json.error;
        throw new Error(`Ingestion failed: ${error.message}`);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:245',message:'Ingestion client - success',data:{eventId:json.data.event_id,ingestDepth:json.data.ingest_depth,racesIngested:json.data.races_ingested},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
      // #endregion
      return json.data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingestion-client.ts:250',message:'Ingestion client - error caught',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:undefined,isAbortError:error instanceof Error&&error.name==='AbortError',isNetworkError:error instanceof Error&&(error.message.includes('fetch failed')||error.message.includes('ECONNREFUSED')||error.message.includes('ENOTFOUND'))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Ingestion timeout: The import is taking longer than expected. Please check back later - the import may still be processing in the background.");
        }
        // Handle network errors
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
          throw new Error("Cannot connect to ingestion service. Please ensure the ingestion service is running.");
        }
      }
      throw error;
    }
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

