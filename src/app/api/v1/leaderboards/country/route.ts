/**
 * @fileoverview Country leaderboard API route
 *
 * @description Returns aggregate main-race points leaderboard for all tracks in a
 *              given country and calendar year. Supports optional class filter,
 *              pagination, and basic sorting.
 *
 * @relatedFiles
 * - src/core/leaderboards/get-country-leaderboard.ts
 * - src/components/organisms/event-analysis/TrackLeaderboardTab.tsx (consumer via country card)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"
import {
  getCountryLeaderboard,
  type CountryLeaderboardSortBy,
} from "@/core/leaderboards/get-country-leaderboard"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized country leaderboard request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const searchParams = request.nextUrl.searchParams

    const country = (searchParams.get("country") ?? "").trim()
    if (!country) {
      return errorResponse("VALIDATION_ERROR", "country is required", {}, 400)
    }

    const yearParam = searchParams.get("year")
    const now = new Date()
    const year = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear()
    if (!Number.isFinite(year) || year < 1900 || year > 3000) {
      return errorResponse("VALIDATION_ERROR", "Invalid year", {}, 400)
    }

    const className = searchParams.get("class_name") || undefined

    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    const sortByParam = searchParams.get("sort_by") as CountryLeaderboardSortBy | null

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0
    const sortBy: CountryLeaderboardSortBy | undefined =
      sortByParam === "name" || sortByParam === "points" ? sortByParam : undefined

    const result = await getCountryLeaderboard({
      countryQuery: country,
      year,
      className: className || null,
      limit,
      offset,
      sortBy,
    })

    requestLogger.info("Country leaderboard fetched", {
      country: result.countryQuery,
      year: result.year,
      totalCount: result.totalCount,
      returnedCount: result.rows.length,
    })

    return successResponse({
      country: result.countryQuery,
      year: result.year,
      total: result.totalCount,
      rows: result.rows,
      classes: result.classes,
    })
  } catch (error) {
    requestLogger.error("Error in country leaderboard API", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
