/**
 * @fileoverview Event import business logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Business logic for importing events via ingestion pipeline
 *
 * @purpose Provides a clean interface for triggering event import. Integrates
 *          with the Python ingestion service to trigger async import jobs.
 *
 * @relatedFiles
 * - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md (ingestion pipeline)
 * - ingestion/ingestion/pipeline.py (Python ingestion pipeline)
 * - src/lib/ingestion-client.ts (Python service client)
 */

import { ingestionClient } from "@/lib/ingestion-client"
import { getEventById } from "./repo"

export interface ImportEventInput {
  eventId: string
  depth?: "laps_full" | "none"
}

export type ImportEventResult =
  | {
      success: true
      eventId: string
      status: "started" | "completed" | "failed"
      ingestDepth?: string
      lastIngestedAt?: string
      racesIngested?: number
      resultsIngested?: number
      lapsIngested?: number
    }
  | {
      success: false
      error: {
        code: string
        message: string
      }
    }

/**
 * Import an event via the ingestion pipeline
 *
 * Triggers async import of event data from LiveRC. The import runs
 * asynchronously, so this function returns immediately with a "started" status.
 *
 * @param input - Import parameters
 * @returns Import result with status or error
 */
export async function importEvent(input: ImportEventInput): Promise<ImportEventResult> {
  try {
    // Verify event exists
    const event = await getEventById(input.eventId)
    if (!event) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Event not found",
        },
      }
    }

    // Call Python ingestion service
    const result = await ingestionClient.ingestEvent(input.eventId, input.depth || "laps_full")

    return {
      success: true,
      eventId: input.eventId,
      status: "started", // Ingestion is async, returns immediately
      ingestDepth:
        "ingest_depth" in result ? result.ingest_depth : input.depth ?? "laps_full",
      // Note: racesIngested, resultsIngested, lapsIngested will be available
      // after ingestion completes, but initial response shows 0 as ingestion is async
      racesIngested: "races_ingested" in result ? (result.races_ingested || 0) : 0,
      resultsIngested: "results_ingested" in result ? (result.results_ingested || 0) : 0,
      lapsIngested: "laps_ingested" in result ? (result.laps_ingested || 0) : 0,
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INGESTION_FAILED",
        message: error instanceof Error ? error.message : "Failed to import event",
      },
    }
  }
}
