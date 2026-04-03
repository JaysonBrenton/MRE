/**
 * @fileoverview LiveRC entry list API route
 *
 * @description Fetches the event entry list from LiveRC for a given event.
 *              Only available for LiveRC events (sourceEventId + track slug).
 *
 * @relatedFiles
 * - src/lib/ingestion-client.ts (getEventEntryList)
 * - src/components/organisms/event-analysis/LiveRCEntryListTable.tsx
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ingestionClient } from "@/lib/ingestion-client"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"
import { CACHE_CONTROL } from "@/lib/api-utils"

/** Parse LiveRC event URL to get track slug and source event id (e.g. https://rcra.liverc.com/results/?p=view_event&id=491882). */
function parseLiveRCUrl(eventUrl: string): { trackSlug: string; sourceEventId: string } | null {
  try {
    const url = new URL(eventUrl)
    if (!url.hostname.endsWith(".liverc.com")) return null
    const slug = url.hostname.slice(0, -".liverc.com".length)
    const id = url.searchParams.get("id")
    if (!slug?.trim() || !id?.trim()) return null
    return { trackSlug: slug, sourceEventId: id }
  } catch {
    return null
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized entry list request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { eventId } = await params

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        sourceEventId: true,
        eventUrl: true,
        track: {
          select: {
            sourceTrackSlug: true,
          },
        },
      },
    })

    if (!event) {
      requestLogger.warn("Event not found for entry list", { eventId })
      return errorResponse("NOT_FOUND", "Event not found", {}, 404)
    }

    let trackSlug = event.track?.sourceTrackSlug?.trim()
    let sourceEventId = event.sourceEventId?.trim()

    if ((!trackSlug || !sourceEventId) && event.eventUrl?.trim()) {
      const parsed = parseLiveRCUrl(event.eventUrl)
      if (parsed) {
        trackSlug = trackSlug || parsed.trackSlug
        sourceEventId = sourceEventId || parsed.sourceEventId
      }
    }

    if (!trackSlug || !sourceEventId) {
      requestLogger.debug("Entry list not available - not a LiveRC event", {
        eventId,
        hasTrackSlug: !!trackSlug,
        hasSourceEventId: !!sourceEventId,
      })
      return errorResponse(
        "ENTRY_LIST_NOT_AVAILABLE",
        "Entry list is only available for LiveRC events.",
        {},
        400
      )
    }

    const entryListData = await ingestionClient.getEventEntryList(trackSlug, sourceEventId)

    requestLogger.info("Entry list fetched", {
      eventId,
      sourceEventId,
      classCount: Object.keys(entryListData.entries_by_class).length,
    })

    const classOrder =
      (entryListData.class_order?.length ?? 0) > 0
        ? entryListData.class_order
        : Object.keys(entryListData.entries_by_class)
    return successResponse(
      {
        source_event_id: entryListData.source_event_id,
        entries_by_class: entryListData.entries_by_class,
        class_order: classOrder,
      },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    if (err.message?.includes("scraping") || err.message?.toLowerCase().includes("disabled")) {
      requestLogger.warn("Entry list unavailable - scraping disabled")
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "LiveRC entry list is not available at the moment. Please try again later.",
        {},
        503
      )
    }
    requestLogger.error("Entry list fetch failed", {
      error: err.message,
      eventId: (await params).eventId,
    })
    const info = handleApiError(error, request, requestId)
    return errorResponse(info.code, info.message, undefined, info.statusCode)
  }
}
