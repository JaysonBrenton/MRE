#!/usr/bin/env node
/**
 * One-off script to inspect venue correction data for "2026 RCRA Nationals".
 * Run: docker exec -it mre-app node scripts/check-venue-correction.mjs
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const eventName = "2026 RCRA Nationals"
  const event = await prisma.event.findFirst({
    where: { eventName },
    select: {
      id: true,
      eventName: true,
      trackId: true,
      track: { select: { id: true, trackName: true } },
      eventVenueCorrection: {
        include: {
          venueTrack: { select: { id: true, trackName: true } },
        },
      },
    },
  })
  if (!event) {
    console.log("Event not found:", eventName)
    return
  }
  console.log("Event:", event.id)
  console.log("  eventName:", event.eventName)
  console.log("  trackId (default):", event.trackId)
  console.log("  track (default):", event.track?.trackName ?? "—")
  console.log("EventVenueCorrection:", event.eventVenueCorrection ? "exists" : "null")
  if (event.eventVenueCorrection) {
    const c = event.eventVenueCorrection
    console.log("  eventId:", c.eventId)
    console.log("  venueTrackId:", c.venueTrackId ?? "null")
    console.log("  venueTrack:", c.venueTrack ? c.venueTrack.trackName : "—")
  }
  const allCorrections = await prisma.eventVenueCorrection.findMany({
    include: {
      venueTrack: { select: { trackName: true } },
      event: { select: { eventName: true } },
    },
  })
  console.log("\nAll EventVenueCorrection rows:", allCorrections.length)
  allCorrections.forEach((c) => {
    console.log(
      "  -",
      c.event.eventName,
      "=> venueTrackId:",
      c.venueTrackId,
      "=>",
      c.venueTrack?.trackName ?? "null"
    )
  })

  const canberra = await prisma.track.findFirst({
    where: { trackName: { contains: "Canberra", mode: "insensitive" } },
    select: { id: true, trackName: true },
  })
  console.log(
    "\nTrack matching 'Canberra':",
    canberra ? `${canberra.trackName} (id: ${canberra.id})` : "none"
  )

  // Fix: set correction to Canberra if it's currently null (e.g. saved null due to past POST body bug)
  if (event.eventVenueCorrection?.venueTrackId === null && canberra) {
    await prisma.eventVenueCorrection.update({
      where: { eventId: event.id },
      data: { venueTrackId: canberra.id },
    })
    console.log("\nUpdated EventVenueCorrection.venueTrackId to", canberra.trackName)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
