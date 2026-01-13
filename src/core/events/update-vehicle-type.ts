/**
 * @fileoverview Update vehicle type for a race class
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description Core function to update vehicle type for an EventRaceClass record.
 *
 * @purpose Provides business logic for updating vehicle type, marking it as reviewed,
 *          and recording review metadata.
 */

import { prisma } from "@/lib/prisma"

export interface UpdateVehicleTypeParams {
  eventId: string
  className: string
  vehicleType: string | null
  acceptInference?: boolean
  reviewedBy?: string | null
}

export interface UpdateVehicleTypeResult {
  id: string
  eventId: string
  className: string
  vehicleType: string | null
  vehicleTypeNeedsReview: boolean
  vehicleTypeReviewedAt: Date | null
  vehicleTypeReviewedBy: string | null
}

/**
 * Updates vehicle type for an EventRaceClass record.
 *
 * Finds or creates an EventRaceClass record for the given event and race class,
 * then updates the vehicle type and review status.
 *
 * @param params - Update parameters
 * @returns Updated EventRaceClass record
 *
 * @example
 * const result = await updateVehicleType({
 *   eventId: "event-123",
 *   className: "40+ Electric Buggy",
 *   vehicleType: "1/8 Electric Buggy",
 *   acceptInference: true
 * })
 */
export async function updateVehicleType(
  params: UpdateVehicleTypeParams
): Promise<UpdateVehicleTypeResult> {
  const { eventId, className, vehicleType, acceptInference = false, reviewedBy = null } = params

  // Find or create EventRaceClass record
  const eventRaceClass = await prisma.eventRaceClass.upsert({
    where: {
      eventId_className: {
        eventId,
        className,
      },
    },
    create: {
      eventId,
      className,
      vehicleType,
      vehicleTypeNeedsReview: !acceptInference,
      vehicleTypeReviewedAt: acceptInference ? new Date() : null,
      vehicleTypeReviewedBy: reviewedBy,
    },
    update: {
      vehicleType,
      vehicleTypeNeedsReview: !acceptInference,
      vehicleTypeReviewedAt: acceptInference ? new Date() : vehicleType ? new Date() : null,
      vehicleTypeReviewedBy: reviewedBy,
    },
  })

  // Update all EventEntry records with this className to reference the EventRaceClass
  await prisma.eventEntry.updateMany({
    where: {
      eventId,
      className,
    },
    data: {
      eventRaceClassId: eventRaceClass.id,
    },
  })

  return {
    id: eventRaceClass.id,
    eventId: eventRaceClass.eventId,
    className: eventRaceClass.className,
    vehicleType: eventRaceClass.vehicleType,
    vehicleTypeNeedsReview: eventRaceClass.vehicleTypeNeedsReview,
    vehicleTypeReviewedAt: eventRaceClass.vehicleTypeReviewedAt,
    vehicleTypeReviewedBy: eventRaceClass.vehicleTypeReviewedBy,
  }
}

/**
 * Gets vehicle type for a race class.
 *
 * @param eventId - Event ID
 * @param className - Race class name
 * @returns EventRaceClass record or null if not found
 */
export async function getVehicleType(
  eventId: string,
  className: string
): Promise<UpdateVehicleTypeResult | null> {
  const eventRaceClass = await prisma.eventRaceClass.findUnique({
    where: {
      eventId_className: {
        eventId,
        className,
      },
    },
  })

  if (!eventRaceClass) {
    return null
  }

  return {
    id: eventRaceClass.id,
    eventId: eventRaceClass.eventId,
    className: eventRaceClass.className,
    vehicleType: eventRaceClass.vehicleType,
    vehicleTypeNeedsReview: eventRaceClass.vehicleTypeNeedsReview,
    vehicleTypeReviewedAt: eventRaceClass.vehicleTypeReviewedAt,
    vehicleTypeReviewedBy: eventRaceClass.vehicleTypeReviewedBy,
  }
}

