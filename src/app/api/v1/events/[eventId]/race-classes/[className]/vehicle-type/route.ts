/**
 * @fileoverview API endpoint for vehicle type management
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description API endpoints for getting and updating vehicle type for a race class
 *
 * @purpose Provides REST API for vehicle type review and editing functionality
 */

import { NextRequest, NextResponse } from "next/server"
import { getVehicleType, updateVehicleType } from "@/core/events/update-vehicle-type"
import { auth } from "@/lib/auth"

/**
 * GET /api/v1/events/[eventId]/race-classes/[className]/vehicle-type
 *
 * Get vehicle type for a race class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; className: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      )
    }

    const { eventId, className } = await params

    if (!eventId || !className) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "eventId and className are required",
          },
        },
        { status: 400 }
      )
    }

    const vehicleType = await getVehicleType(eventId, decodeURIComponent(className))

    if (!vehicleType) {
      return NextResponse.json(
        {
          success: true,
          data: null,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      data: vehicleType,
    })
  } catch (error) {
    console.error("[API] Error getting vehicle type:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get vehicle type",
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/events/[eventId]/race-classes/[className]/vehicle-type
 *
 * Update vehicle type for a race class
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; className: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      )
    }

    const { eventId, className } = await params

    if (!eventId || !className) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "eventId and className are required",
          },
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { vehicleType, acceptInference } = body

    // Decode className - Next.js may already decode it, but decodeURIComponent is idempotent for non-encoded strings
    const decodedClassName = decodeURIComponent(className)

    console.log("[API] PUT vehicle-type request:", {
      eventId,
      classNameRaw: className,
      classNameDecoded: decodedClassName,
      vehicleType,
      acceptInference,
      userId: session.user?.id,
    })

    if (vehicleType === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "vehicleType is required",
          },
        },
        { status: 400 }
      )
    }

    const result = await updateVehicleType({
      eventId,
      className: decodedClassName,
      vehicleType: vehicleType === "Unknown" ? null : vehicleType,
      acceptInference: acceptInference === true,
      reviewedBy: session.user?.id ?? null,
    })

    console.log("[API] PUT vehicle-type result:", {
      id: result.id,
      eventId: result.eventId,
      className: result.className,
      vehicleType: result.vehicleType,
      vehicleTypeNeedsReview: result.vehicleTypeNeedsReview,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("[API] Error updating vehicle type:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update vehicle type",
        },
      },
      { status: 500 }
    )
  }
}
