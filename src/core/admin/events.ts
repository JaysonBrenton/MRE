/**
 * @fileoverview Admin event management operations
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Functions for managing events in the admin console
 *
 * @purpose Provides event management functionality for administrators,
 *          including viewing, deleting, and triggering re-ingestion.
 *
 * @relatedFiles
 * - src/core/events/repo.ts (event repository)
 * - src/core/admin/audit.ts (audit logging)
 */

import { prisma } from "@/lib/prisma"
import { getEventById } from "@/core/events/repo"
import { createAuditLog } from "./audit"
import type { Event, Prisma } from "@prisma/client"

/**
 * Get all events with pagination and filtering
 *
 * @param filters - Filter and pagination options
 * @returns Paginated events
 */
export async function getEvents(filters: {
  trackId?: string
  startDate?: Date
  endDate?: Date
  ingestDepth?: "none" | "laps_full"
  page?: number
  pageSize?: number
}): Promise<{
  events: (Event & { track: { id: string; trackName: string } })[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const skip = (page - 1) * pageSize

  const where: Prisma.EventWhereInput = {}

  if (filters.trackId) {
    where.trackId = filters.trackId
  }
  if (filters.startDate || filters.endDate) {
    where.eventDate = {}
    if (filters.startDate) {
      where.eventDate.gte = filters.startDate
    }
    if (filters.endDate) {
      where.eventDate.lte = filters.endDate
    }
  }
  if (filters.ingestDepth) {
    where.ingestDepth = filters.ingestDepth
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { eventDate: "desc" },
      skip,
      take: pageSize,
      include: {
        track: {
          select: {
            id: true,
            trackName: true,
          },
        },
      },
    }),
    prisma.event.count({ where }),
  ])

  return {
    events,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Delete an event
 *
 * @param eventId - Event ID to delete
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 */
export async function deleteEvent(
  eventId: string,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const event = await getEventById(eventId)
  if (!event) {
    throw new Error("Event not found")
  }

  await prisma.event.delete({
    where: { id: eventId },
  })

  await createAuditLog({
    userId: adminUserId,
    action: "event.delete",
    resourceType: "event",
    resourceId: eventId,
    details: {
      deletedEvent: {
        eventName: event.eventName,
        eventDate: event.eventDate.toISOString(),
      },
    },
    ipAddress,
    userAgent,
  })
}

/**
 * Mark event for re-ingestion
 *
 * @param eventId - Event ID to re-ingest
 * @param adminUserId - Admin user ID performing the action
 * @param ipAddress - IP address of the admin
 * @param userAgent - User agent of the admin
 */
export async function markEventForReingestion(
  eventId: string,
  adminUserId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<Event> {
  const event = await getEventById(eventId)
  if (!event) {
    throw new Error("Event not found")
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      ingestDepth: "none",
      lastIngestedAt: null,
    },
  })

  await createAuditLog({
    userId: adminUserId,
    action: "event.mark_reingest",
    resourceType: "event",
    resourceId: eventId,
    details: {
      eventName: event.eventName,
    },
    ipAddress,
    userAgent,
  })

  return updatedEvent
}
