/**
 * Per-user host track: which catalogue `Track` the user considers the physical host for an event.
 */

import { prisma } from "@/lib/prisma"

/** Stale Prisma singleton (pre-`prisma generate` / no restart) yields undefined here. */
function userEventHostTrackModel() {
  const m = prisma.userEventHostTrack
  if (!m) {
    throw new Error(
      "Prisma client is missing UserEventHostTrack. In Docker run: `docker exec -it mre-app npx prisma generate` then `docker compose restart app` (or rebuild). The running process must reload @prisma/client after schema changes."
    )
  }
  return m
}

const TRACK_PICK_SELECT = {
  id: true,
  trackName: true,
  trackUrl: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  phone: true,
  website: true,
  email: true,
  facebookUrl: true,
  isActive: true,
} as const

export async function getUserEventHostTrackRow(userId: string, eventId: string) {
  return userEventHostTrackModel().findUnique({
    where: { userId_eventId: { userId, eventId } },
    include: { hostTrack: { select: TRACK_PICK_SELECT } },
  })
}

export async function upsertUserEventHostTrack(
  userId: string,
  eventId: string,
  hostTrackId: string
) {
  const [ev, track] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }),
    prisma.track.findFirst({
      where: { id: hostTrackId, isActive: true },
      select: { id: true },
    }),
  ])
  if (!ev) {
    const err = new Error("EVENT_NOT_FOUND")
    ;(err as Error & { code?: string }).code = "EVENT_NOT_FOUND"
    throw err
  }
  if (!track) {
    const err = new Error("TRACK_NOT_FOUND_OR_INACTIVE")
    ;(err as Error & { code?: string }).code = "TRACK_NOT_FOUND"
    throw err
  }

  return userEventHostTrackModel().upsert({
    where: { userId_eventId: { userId, eventId } },
    create: { userId, eventId, hostTrackId },
    update: { hostTrackId },
    include: { hostTrack: { select: TRACK_PICK_SELECT } },
  })
}

export async function deleteUserEventHostTrack(userId: string, eventId: string): Promise<boolean> {
  try {
    await userEventHostTrackModel().delete({
      where: { userId_eventId: { userId, eventId } },
    })
    return true
  } catch {
    return false
  }
}

export async function searchTracksForHostPicker(query: string, limit: number) {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return []
  }
  const take = Math.min(Math.max(limit, 1), 50)
  return prisma.track.findMany({
    where: {
      isActive: true,
      OR: [
        { trackName: { contains: trimmed, mode: "insensitive" } },
        { city: { contains: trimmed, mode: "insensitive" } },
        { sourceTrackSlug: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      trackName: true,
      sourceTrackSlug: true,
      city: true,
      state: true,
      country: true,
      trackUrl: true,
      address: true,
    },
    take,
    orderBy: [{ trackName: "asc" }],
  })
}
