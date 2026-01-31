import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Find a track with events - try "The Dirt" Nitro Challenge first
  let track = await prisma.track.findFirst({
    where: {
      isActive: true,
      source: "liverc",
      sourceTrackSlug: "dnc",
    },
    include: {
      events: {
        take: 1,
        orderBy: {
          eventDate: "desc",
        },
      },
    },
  })

  // If not found, find any track with events
  if (!track || track.events.length === 0) {
    track = await prisma.track.findFirst({
      where: {
        isActive: true,
        source: "liverc",
        events: {
          some: {},
        },
      },
      include: {
        events: {
          take: 1,
          orderBy: {
            eventDate: "desc",
          },
        },
      },
    })
  }

  if (!track) {
    console.error("No active tracks found")
    process.exit(1)
  }

  if (track.events.length === 0) {
    console.error(`Track "${track.trackName}" has no events`)
    process.exit(1)
  }

  const event = track.events[0]
  console.log(`Selected Track: ${track.trackName} (${track.sourceTrackSlug})`)
  console.log(`Selected Event: ${event.eventName} (ID: ${event.id})`)
  console.log(`Event Date: ${event.eventDate.toISOString().split("T")[0]}`)
  console.log(`Source Event ID: ${event.sourceEventId}`)
  console.log(`Current Ingest Depth: ${event.ingestDepth}`)
  console.log("")

  // Now we'll ingest this event
  console.log("Event details retrieved. Ready to ingest.")
  console.log(`Track ID: ${track.id}`)
  console.log(`Event ID: ${event.id}`)
  console.log(`Source Event ID: ${event.sourceEventId}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})
