/**
 * @fileoverview Check entry lists for driver name
 * 
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 * 
 * @description Business logic for checking if a driver name appears in entry lists
 *              for liverc events and database events
 * 
 * @purpose Provides functionality to check entry lists from LiveRC and database
 *          events to determine if a specific driver name appears in them. Uses
 *          fuzzy matching via name normalization for consistent results.
 * 
 * @relatedFiles
 * - src/lib/ingestion-client.ts (ingestion service client)
 * - src/core/users/name-normalizer.ts (name normalization utility)
 * - src/core/events/repo.ts (database event queries)
 */

import { ingestionClient } from "@/lib/ingestion-client"
import { normalizeDriverName } from "@/core/users/name-normalizer"
import { checkDbEventsForDriver } from "@/core/events/repo"
import { logger } from "@/lib/logger"

export interface LiveRCEvent {
  sourceEventId: string
  trackSlug: string
}

export interface DbEvent {
  eventId: string
}

export interface CheckEntryListsResult {
  driverInEvents: Record<string, boolean> // Map of sourceEventId (for LiveRC) or eventId (for DB) to boolean
  errors: Record<string, string> // Map of sourceEventId/eventId to error message
}

/**
 * Check if a driver name appears in entry lists for multiple liverc events
 * 
 * @param livercEvents - Array of liverc events to check (must have sourceEventId and trackSlug)
 * @param dbEvents - Array of database events to check (must have eventId)
 * @param driverName - Driver name to search for
 * @param abortSignal - Optional AbortSignal to cancel the operation
 * @returns Map of event source IDs (for LiveRC) or event IDs (for DB) to boolean (true if driver found, false if not found, undefined if error)
 */
export async function checkEntryListsForDriver(
  livercEvents: LiveRCEvent[],
  dbEvents: DbEvent[],
  driverName: string,
  abortSignal?: AbortSignal
): Promise<CheckEntryListsResult> {
  const driverInEvents: Record<string, boolean> = {}
  const errors: Record<string, string> = {}

  if (!driverName || !driverName.trim()) {
    logger.warn("Empty driver name provided to checkEntryListsForDriver")
    return { driverInEvents, errors }
  }

  // Normalize the driver name once for comparison
  const normalizedDriverName = normalizeDriverName(driverName.trim())

  if (!normalizedDriverName) {
    logger.warn("Driver name normalized to empty string", { driverName })
    return { driverInEvents, errors }
  }

  logger.debug("Checking entry lists for driver", {
    driverName,
    normalizedDriverName,
    livercEventCount: livercEvents.length,
    dbEventCount: dbEvents.length,
  })

  // Check if already aborted
  if (abortSignal?.aborted) {
    logger.debug("Entry list check aborted before starting")
    return { driverInEvents, errors }
  }

  // Check LiveRC events in parallel
  const livercCheckPromises = livercEvents.map(async (event) => {
    try {
      // Check if aborted before each check
      if (abortSignal?.aborted) {
        return
      }

      logger.debug("Starting entry list check for LiveRC event", {
        sourceEventId: event.sourceEventId,
        trackSlug: event.trackSlug,
      })

      // Fetch entry list from ingestion service
      // Note: ingestionClient.getEventEntryList would need to support AbortSignal
      // For now, we check the signal before and after the call
      const entryListData = await ingestionClient.getEventEntryList(
        event.trackSlug,
        event.sourceEventId
      )

      // Check if aborted after fetch
      if (abortSignal?.aborted) {
        return
      }

      logger.debug("Entry list fetched for LiveRC event", {
        sourceEventId: event.sourceEventId,
        classCount: Object.keys(entryListData.entries_by_class).length,
      })

      // Check all driver names in the entry list
      let found = false
      for (const [className, drivers] of Object.entries(entryListData.entries_by_class)) {
        for (const driver of drivers) {
          const normalizedEntryName = normalizeDriverName(driver.driver_name)
          if (normalizedEntryName === normalizedDriverName) {
            found = true
            logger.debug("Driver found in LiveRC entry list", {
              sourceEventId: event.sourceEventId,
              className,
              driverName: driver.driver_name,
              normalizedEntryName,
            })
            break
          }
        }
        if (found) break
      }

      driverInEvents[event.sourceEventId] = found

      if (!found) {
        logger.debug("Driver not found in LiveRC entry list", {
          sourceEventId: event.sourceEventId,
        })
      }
    } catch (error) {
      // Log error but don't block other events
      const errorMessage = error instanceof Error ? error.message : String(error)
      errors[event.sourceEventId] = errorMessage
      logger.warn("Error checking LiveRC entry list for event", {
        sourceEventId: event.sourceEventId,
        error: errorMessage,
        errorName: error instanceof Error ? error.name : typeof error,
      })
      // Don't set driverInEvents for failed checks - leave undefined
    }
  })

  // Check if aborted before DB checks
  if (abortSignal?.aborted) {
    logger.debug("Entry list check aborted before DB checks")
    return { driverInEvents, errors }
  }

  // Check DB events
  let dbResults: Record<string, boolean> = {}
  if (dbEvents.length > 0) {
    try {
      const dbEventIds = dbEvents.map(e => e.eventId)
      dbResults = await checkDbEventsForDriver(dbEventIds, normalizedDriverName)
      
      // Check if aborted after DB check
      if (abortSignal?.aborted) {
        return { driverInEvents, errors }
      }
      
      // Merge DB results into driverInEvents
      for (const [eventId, found] of Object.entries(dbResults)) {
        driverInEvents[eventId] = found
        if (found) {
          logger.debug("Driver found in DB event", {
            eventId,
          })
        } else {
          logger.debug("Driver not found in DB event", {
            eventId,
          })
        }
      }
    } catch (error) {
      // Log error but don't block LiveRC checks
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn("Error checking DB events for driver", {
        error: errorMessage,
        errorName: error instanceof Error ? error.name : typeof error,
        dbEventCount: dbEvents.length,
      })
      // Mark all DB events as having errors
      for (const event of dbEvents) {
        errors[event.eventId] = errorMessage
      }
    }
  }

  // Wait for all LiveRC checks to complete (use allSettled to handle partial failures)
  // This ensures we get results even if some requests fail or timeout
  const livercResults = await Promise.allSettled(livercCheckPromises)
  
  // Log any rejected promises (shouldn't happen since we catch errors, but good to know)
  const rejectedCount = livercResults.filter((r) => r.status === "rejected").length
  if (rejectedCount > 0) {
    logger.warn("Some LiveRC entry list checks were rejected", {
      rejectedCount,
      totalLiveRCEvents: livercEvents.length,
    })
  }

  logger.info("Entry list check completed", {
    driverName,
    checkedLiveRCEvents: livercEvents.length,
    checkedDbEvents: dbEvents.length,
    foundInEvents: Object.values(driverInEvents).filter(Boolean).length,
    errors: Object.keys(errors).length,
  })

  return { driverInEvents, errors }
}

