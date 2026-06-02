/**
 * GET /api/v1/events/search/suggest?q=&limit=
 *
 * Authenticated, database-only type-ahead suggestions for the Event Search
 * omnibox. Returns matching tracks and events. Performs no LiveRC discovery.
 *
 * @relatedFiles
 * - src/core/events/suggest-event-search.ts (business logic)
 * - docs/architecture/event-search-omnibox.md (specification)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { suggestEventSearch } from "@/core/events/suggest-event-search"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  try {
    const session = await auth()
    if (!session?.user) {
      requestLogger.warn("Unauthorized event search suggest request")
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const q = request.nextUrl.searchParams.get("q") ?? ""
    const limitRaw = request.nextUrl.searchParams.get("limit")
    const limit = limitRaw !== null ? parseInt(limitRaw, 10) : undefined

    const result = await suggestEventSearch(q, limit)

    requestLogger.debug("Event search suggest", {
      query: result.query,
      trackCount: result.tracks.length,
      eventCount: result.events.length,
    })

    return successResponse(result, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
