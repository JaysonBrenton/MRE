/**
 * @fileoverview Countries list for leaderboards
 *
 * @description Returns the distinct list of track countries that have events,
 *              for use in country leaderboard filters.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized countries list request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    // Only include countries that have at least one event.
    const tracks = await prisma.track.findMany({
      where: {
        country: {
          not: null,
        },
        events: {
          some: {},
        },
      },
      select: {
        country: true,
      },
      distinct: ["country"],
    })

    const countries = Array.from(
      new Set(tracks.map((t) => t.country).filter((c): c is string => !!c && c.trim().length > 0))
    ).sort((a, b) => a.localeCompare(b))

    requestLogger.info("Countries list fetched", {
      count: countries.length,
    })

    return successResponse({
      countries,
    })
  } catch (error) {
    requestLogger.error("Error in countries list API", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
