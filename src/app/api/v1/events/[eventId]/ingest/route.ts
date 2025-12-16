// @fileoverview Event ingestion API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for triggering event ingestion
// 
// @purpose Proxies ingestion requests to Python service

import { NextRequest } from "next/server";
import { ingestionClient } from "@/lib/ingestion-client";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { API_TIMEOUTS } from "@/core/auth/constants"

// Increase timeout for large event ingestion (up to 10 minutes)
export const maxDuration = API_TIMEOUTS.INGESTION_MAX_DURATION

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Check rate limit for ingestion endpoints
    const rateLimitResult = checkRateLimit(request, RATE_LIMITS.ingestion)
    if (!rateLimitResult.allowed) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many ingestion requests. Please try again later.",
        {
          resetTime: rateLimitResult.resetTime,
        },
        429
      )
    }

    const { eventId } = await params;
    const body = await request.json();
    const depth = body.depth || "laps_full";

    const result = await ingestionClient.ingestEvent(eventId, depth);

    return successResponse(result);
  } catch (error: unknown) {
    console.error("Error triggering ingestion:", error);
    
    if (error instanceof Error) {
      // Log full error details for debugging
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        eventId,
      });
      
      if (error.message.includes("Ingestion failed")) {
        return errorResponse(
          "INGESTION_FAILED",
          error.message,
          { originalError: error.message },
          500
        );
      }
      
      // Return the actual error message if available
      return errorResponse(
        "INGESTION_FAILED",
        error.message || "Failed to ingest event",
        { originalError: error.message },
        500
      );
    }
    
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to ingest event",
      { error: String(error) },
      500
    );
  }
}

