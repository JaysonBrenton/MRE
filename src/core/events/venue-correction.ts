/**
 * @fileoverview Event venue correction - non-destructive venue override with admin moderation
 *
 * @description CRUD and eligibility for EventVenueCorrection and EventVenueCorrectionRequest.
 * Event-linked users submit requests; admins approve or reject. Approved corrections drive venue display and weather.
 */

import { prisma } from "@/lib/prisma"
import type { EventVenueCorrectionRequestStatus } from "@prisma/client"

export interface VenueCorrectionResult {
  id: string
  eventId: string
  venueTrackId: string | null
  venueTrackName: string | null
  submittedByUserId: string
  approvedAt: Date
  approvedByUserId: string
  createdAt: Date
}

export interface VenueCorrectionRequestResult {
  id: string
  eventId: string
  venueTrackId: string | null
  venueTrackName: string | null
  submittedByUserId: string
  status: EventVenueCorrectionRequestStatus
  reviewedAt: Date | null
  reviewedByUserId: string | null
  adminNotes: string | null
  createdAt: Date
  event: { eventName: string; track: { trackName: string } }
  submittedBy: { id: string; driverName: string | null; email: string }
}

/**
 * Check if user has EventDriverLink for this event (event-linked user)
 */
export async function isEventLinkedUser(eventId: string, userId: string): Promise<boolean> {
  const link = await prisma.eventDriverLink.findFirst({
    where: { eventId, userId },
  })
  return !!link
}

/**
 * Get approved EventVenueCorrection for event (if any)
 */
export async function getApprovedCorrection(
  eventId: string
): Promise<
  | (VenueCorrectionResult & {
      venueTrack: {
        latitude: number | null
        longitude: number | null
        address: string | null
      } | null
    })
  | null
> {
  const correction = await prisma.eventVenueCorrection.findUnique({
    where: { eventId },
    include: {
      venueTrack: {
        select: {
          trackName: true,
          latitude: true,
          longitude: true,
          address: true,
          city: true,
          state: true,
          country: true,
        },
      },
    },
  })
  if (!correction) return null
  return {
    id: correction.id,
    eventId: correction.eventId,
    venueTrackId: correction.venueTrackId,
    venueTrackName: correction.venueTrack?.trackName ?? null,
    submittedByUserId: correction.submittedByUserId,
    approvedAt: correction.approvedAt,
    approvedByUserId: correction.approvedByUserId,
    createdAt: correction.createdAt,
    venueTrack: correction.venueTrack
      ? {
          latitude: correction.venueTrack.latitude,
          longitude: correction.venueTrack.longitude,
          address:
            [
              correction.venueTrack.address,
              correction.venueTrack.city,
              correction.venueTrack.state,
              correction.venueTrack.country,
            ]
              .filter(Boolean)
              .join(", ") || null,
        }
      : null,
  }
}

/**
 * Get current user's request for this event (pending or rejected)
 */
export async function getUserRequestForEvent(
  eventId: string,
  userId: string
): Promise<VenueCorrectionRequestResult | null> {
  const request = await prisma.eventVenueCorrectionRequest.findUnique({
    where: { eventId },
    include: {
      event: { select: { eventName: true, track: { select: { trackName: true } } } },
      venueTrack: { select: { trackName: true } },
      submittedBy: { select: { id: true, driverName: true, email: true } },
    },
  })
  if (!request || request.submittedByUserId !== userId) return null
  return {
    id: request.id,
    eventId: request.eventId,
    venueTrackId: request.venueTrackId,
    venueTrackName: request.venueTrack?.trackName ?? null,
    submittedByUserId: request.submittedByUserId,
    status: request.status,
    reviewedAt: request.reviewedAt,
    reviewedByUserId: request.reviewedByUserId,
    adminNotes: request.adminNotes,
    createdAt: request.createdAt,
    event: request.event,
    submittedBy: request.submittedBy,
  }
}

/**
 * Submit or update venue correction request (event-linked users only)
 * One pending per event; new submission overwrites previous pending
 */
export async function submitVenueCorrectionRequest(
  eventId: string,
  userId: string,
  venueTrackId: string | null
): Promise<VenueCorrectionRequestResult> {
  const linked = await isEventLinkedUser(eventId, userId)
  if (!linked) {
    throw new Error("Only event-linked users can submit venue corrections")
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) {
    throw new Error("Event not found")
  }

  if (venueTrackId !== null) {
    const track = await prisma.track.findUnique({ where: { id: venueTrackId } })
    if (!track) {
      throw new Error("Track not found")
    }
  }

  const request = await prisma.eventVenueCorrectionRequest.upsert({
    where: { eventId },
    create: {
      eventId,
      venueTrackId,
      submittedByUserId: userId,
      status: "pending",
    },
    update: {
      venueTrackId,
      submittedByUserId: userId,
      status: "pending",
      reviewedAt: null,
      reviewedByUserId: null,
      adminNotes: null,
    },
    include: {
      event: { select: { eventName: true, track: { select: { trackName: true } } } },
      venueTrack: { select: { trackName: true } },
      submittedBy: { select: { id: true, driverName: true, email: true } },
    },
  })

  return {
    id: request.id,
    eventId: request.eventId,
    venueTrackId: request.venueTrackId,
    venueTrackName: request.venueTrack?.trackName ?? null,
    submittedByUserId: request.submittedByUserId,
    status: request.status,
    reviewedAt: request.reviewedAt,
    reviewedByUserId: request.reviewedByUserId,
    adminNotes: request.adminNotes,
    createdAt: request.createdAt,
    event: request.event,
    submittedBy: request.submittedBy,
  }
}

/**
 * Undo (delete) own pending request
 */
export async function deleteOwnPendingRequest(eventId: string, userId: string): Promise<boolean> {
  const request = await prisma.eventVenueCorrectionRequest.findUnique({
    where: { eventId },
  })
  if (!request || request.submittedByUserId !== userId || request.status !== "pending") {
    return false
  }
  await prisma.eventVenueCorrectionRequest.delete({ where: { id: request.id } })
  return true
}

/**
 * List venue correction requests for admin (pending and optionally all)
 */
export async function listVenueCorrectionRequests(options?: {
  status?: EventVenueCorrectionRequestStatus
}): Promise<VenueCorrectionRequestResult[]> {
  const requests = await prisma.eventVenueCorrectionRequest.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { eventName: true, track: { select: { trackName: true } } } },
      venueTrack: { select: { trackName: true } },
      submittedBy: { select: { id: true, driverName: true, email: true } },
    },
  })
  return requests.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    venueTrackId: r.venueTrackId,
    venueTrackName: r.venueTrack?.trackName ?? null,
    submittedByUserId: r.submittedByUserId,
    status: r.status,
    reviewedAt: r.reviewedAt,
    reviewedByUserId: r.reviewedByUserId,
    adminNotes: r.adminNotes,
    createdAt: r.createdAt,
    event: r.event,
    submittedBy: r.submittedBy,
  }))
}

export type ReviewVenueCorrectionResult =
  | { action: "approved"; correction: VenueCorrectionResult }
  | { action: "rejected"; request: VenueCorrectionRequestResult }

/**
 * Admin: Approve or reject a venue correction request
 * Approve: upsert EventVenueCorrection, delete request
 * Reject: set status to rejected (keep request so user sees rejection)
 */
export async function reviewVenueCorrectionRequest(
  requestId: string,
  adminUserId: string,
  action: "approve" | "reject",
  adminNotes?: string | null
): Promise<ReviewVenueCorrectionResult | null> {
  const request = await prisma.eventVenueCorrectionRequest.findUnique({
    where: { id: requestId },
    include: {
      event: { select: { eventName: true, track: { select: { trackName: true } } } },
      venueTrack: { select: { trackName: true } },
      submittedBy: { select: { id: true, driverName: true, email: true } },
    },
  })
  if (!request) return null

  const now = new Date()
  if (action === "approve") {
    const correction = await prisma.$transaction(async (tx) => {
      const c = await tx.eventVenueCorrection.upsert({
        where: { eventId: request.eventId },
        create: {
          eventId: request.eventId,
          venueTrackId: request.venueTrackId,
          submittedByUserId: request.submittedByUserId,
          approvedAt: now,
          approvedByUserId: adminUserId,
        },
        update: {
          venueTrackId: request.venueTrackId,
          submittedByUserId: request.submittedByUserId,
          approvedAt: now,
          approvedByUserId: adminUserId,
        },
      })
      await tx.eventVenueCorrectionRequest.delete({ where: { id: requestId } })
      return c
    })
    return {
      action: "approved",
      correction: {
        id: correction.id,
        eventId: correction.eventId,
        venueTrackId: correction.venueTrackId,
        venueTrackName: null,
        submittedByUserId: correction.submittedByUserId,
        approvedAt: correction.approvedAt,
        approvedByUserId: correction.approvedByUserId,
        createdAt: correction.createdAt,
      },
    }
  } else {
    const updated = await prisma.eventVenueCorrectionRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewedAt: now,
        reviewedByUserId: adminUserId,
        adminNotes: adminNotes ?? null,
      },
      include: {
        event: { select: { eventName: true, track: { select: { trackName: true } } } },
        venueTrack: { select: { trackName: true } },
        submittedBy: { select: { id: true, driverName: true, email: true } },
      },
    })
    return {
      action: "rejected",
      request: {
        id: updated.id,
        eventId: updated.eventId,
        venueTrackId: updated.venueTrackId,
        venueTrackName: updated.venueTrack?.trackName ?? null,
        submittedByUserId: updated.submittedByUserId,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewedByUserId: updated.reviewedByUserId,
        adminNotes: updated.adminNotes,
        createdAt: updated.createdAt,
        event: updated.event,
        submittedBy: updated.submittedBy,
      },
    }
  }
}
