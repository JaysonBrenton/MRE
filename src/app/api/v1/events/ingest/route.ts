// @fileoverview Event ingestion by source ID API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for ingesting events by source_event_id and track_id
// 
// @purpose Provides user-facing API for ingesting newly discovered LiveRC events
//          that don't yet exist in the database. This route delegates to the
//          ingestion client, following the mobile-safe architecture requirement
//          that API routes should not contain business logic.

import { NextRequest } from "next/server";
import { ingestionClient } from "@/lib/ingestion-client";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError, handleExternalServiceError } from "@/lib/server-error-handler";

// Increase timeout for large event ingestion (up to 10 minutes)
export const maxDuration = 600; // 10 minutes in seconds

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:21',message:'API route POST started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json();
    const { source_event_id, track_id, depth } = body;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:25',message:'Request body parsed',data:{hasSourceEventId:!!source_event_id,hasTrackId:!!track_id,sourceEventId:source_event_id,trackId:track_id,depth:depth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Validate required fields
    if (!source_event_id) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:30',message:'Validation failed - missing source_event_id',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      requestLogger.warn("Validation failed - missing source_event_id")
      return errorResponse(
        "VALIDATION_ERROR",
        "source_event_id is required",
        { field: "source_event_id" },
        400
      );
    }

    if (!track_id) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:38',message:'Validation failed - missing track_id',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      requestLogger.warn("Validation failed - missing track_id")
      return errorResponse(
        "VALIDATION_ERROR",
        "track_id is required",
        { field: "track_id" },
        400
      );
    }

    // Call ingestion client
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:48',message:'Calling ingestion client',data:{sourceEventId:source_event_id,trackId:track_id,depth:depth||'laps_full'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const result = await ingestionClient.ingestEventBySourceId(
      source_event_id,
      track_id,
      depth || "laps_full"
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:54',message:'Ingestion client returned',data:{hasResult:!!result,eventId:result?.event_id,ingestDepth:result?.ingest_depth,racesIngested:result?.races_ingested,status:result?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
    // #endregion

    requestLogger.info("Event ingestion completed", {
      sourceEventId: source_event_id,
      trackId: track_id,
      eventId: result?.event_id,
      racesIngested: result?.races_ingested,
    })

    return successResponse(result);
  } catch (error: unknown) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ingest/route.ts:56',message:'API route error caught',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:undefined,errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Handle external service errors (ingestion service)
    if (error instanceof Error && error.message.includes("Ingestion")) {
      const errorInfo = handleExternalServiceError(
        error,
        "Ingestion Service",
        "ingestEventBySourceId",
        requestLogger
      )
      return errorResponse(
        errorInfo.code,
        errorInfo.message,
        { originalError: error.message },
        errorInfo.statusCode
      )
    }
    
    // Handle other errors
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      { originalError: error instanceof Error ? error.message : String(error) },
      errorInfo.statusCode
    )
  }
}

