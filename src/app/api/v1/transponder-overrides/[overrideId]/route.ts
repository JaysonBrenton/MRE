// @fileoverview Transponder override individual API route
// 
// @created 2025-12-24
// @creator Jayson Brenton
// @lastModified 2025-12-24
// 
// @description API route for updating and deleting individual transponder overrides
// 
// @purpose Provides user-facing API for updating and deleting transponder overrides

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  updateTransponderOverride,
  deleteTransponderOverride,
} from "@/core/transponder-overrides/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized transponder override update request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { overrideId } = await params
    const body = await request.json()
    const { effectiveFromRaceId, transponderNumber } = body

    const override = await updateTransponderOverride(overrideId, {
      effectiveFromRaceId: effectiveFromRaceId !== undefined ? effectiveFromRaceId : undefined,
      transponderNumber,
    })

    requestLogger.info("Transponder override updated", {
      overrideId: override.id,
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
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return errorResponse(
          "NOT_FOUND",
          error.message,
          {},
          404
        )
      }

      if (
        error.message.includes("Invalid transponder") ||
        error.message.includes("already in use")
      ) {
        return errorResponse(
          "VALIDATION_ERROR",
          error.message,
          {},
          400
        )
      }
    }

    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized transponder override deletion request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { overrideId } = await params

    const override = await deleteTransponderOverride(overrideId)

    requestLogger.info("Transponder override deleted", {
      overrideId: override.id,
    })

    return successResponse({
      id: override.id,
      message: "Transponder override deleted successfully",
    })
  } catch (error: unknown) {
    if (
      (error instanceof Error && error.message.includes("not found")) ||
      (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025")
    ) {
      return errorResponse(
        "NOT_FOUND",
        "Transponder override not found",
        {},
        404
      )
    }

    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ overrideId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized transponder override get request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { overrideId } = await params

    // Note: getTransponderOverride requires driverId and eventId, so we'll use Prisma directly
    const { prisma } = await import("@/lib/prisma")
    const override = await prisma.transponderOverride.findUnique({
      where: { id: overrideId },
      include: {
        effectiveFromRace: {
          select: {
            id: true,
            raceLabel: true,
            raceOrder: true,
          },
        },
      },
    })

    if (!override) {
      requestLogger.warn("Transponder override not found", { overrideId })
      return errorResponse(
        "NOT_FOUND",
        "Transponder override not found",
        {},
        404
      )
    }

    requestLogger.info("Transponder override fetched", {
      overrideId: override.id,
    })

    return successResponse({
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
    })
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}
