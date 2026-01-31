// @fileoverview Transponder override API route
//
// @created 2025-12-24
// @creator Jayson Brenton
// @lastModified 2025-12-24
//
// @description API route for managing transponder overrides (CRUD operations)
//
// @purpose Provides user-facing API for creating and listing transponder overrides

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  createTransponderOverride,
  listTransponderOverrides,
} from "@/core/transponder-overrides/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

function isKnownValidationError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message.includes("Invalid transponder") || error.message.includes("already in use"))
  )
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized transponder override creation request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const body = await request.json()
    const { eventId, driverId, effectiveFromRaceId, transponderNumber } = body

    if (!eventId || !driverId || !transponderNumber) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Missing required fields: eventId, driverId, transponderNumber",
        {},
        400
      )
    }

    const override = await createTransponderOverride({
      eventId,
      driverId,
      effectiveFromRaceId: effectiveFromRaceId || null,
      transponderNumber,
      createdBy: session.user?.id || null,
    })

    requestLogger.info("Transponder override created", {
      overrideId: override.id,
      driverId,
      eventId,
    })

    return successResponse({
      id: override.id,
      event_id: override.eventId,
      driver_id: override.driverId,
      effective_from_race_id: override.effectiveFromRaceId,
      transponder_number: override.transponderNumber,
      created_at: override.createdAt.toISOString(),
      updated_at: override.updatedAt.toISOString(),
      created_by: override.createdBy,
    })
  } catch (error: unknown) {
    if (isKnownValidationError(error)) {
      return errorResponse("VALIDATION_ERROR", error.message, {}, 400)
    }

    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized transponder override list request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId") || undefined
    const driverId = searchParams.get("driverId") || undefined

    const overrides = await listTransponderOverrides(eventId, driverId)

    requestLogger.info("Transponder overrides fetched", {
      count: overrides.length,
      eventId: eventId || "all",
      driverId: driverId || "all",
    })

    return successResponse({
      overrides: overrides.map((override) => ({
        id: override.id,
        event_id: override.eventId,
        driver_id: override.driverId,
        effective_from_race_id: override.effectiveFromRaceId,
        effective_from_race_label: override.effectiveFromRace
          ? `${override.effectiveFromRace.raceLabel} (Race ${override.effectiveFromRace.raceOrder || "?"})`
          : "All races",
        transponder_number: override.transponderNumber,
        created_at: override.createdAt.toISOString(),
        updated_at: override.updatedAt.toISOString(),
        created_by: override.createdBy,
      })),
    })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
