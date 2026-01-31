/**
 * Debug script to check event search with driver filter
 *
 * Usage: npx ts-node scripts/debug-event-search.ts <userEmail> <trackId> [startDate] [endDate]
 */

import { PrismaClient, type Prisma } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const userEmail = process.argv[2] || "jaysoncareybrenton@gmail.com"
  const trackId = process.argv[3]
  const startDate = process.argv[4] ? new Date(process.argv[4]) : null
  const endDate = process.argv[5] ? new Date(process.argv[5]) : null

  if (!trackId) {
    console.error(
      "Usage: npx ts-node scripts/debug-event-search.ts <userEmail> <trackId> [startDate] [endDate]"
    )
    process.exit(1)
  }

  console.log(`\n🔍 Debugging event search for:`)
  console.log(`   User: ${userEmail}`)
  console.log(`   Track ID: ${trackId}`)
  if (startDate) console.log(`   Start Date: ${startDate.toISOString().split("T")[0]}`)
  if (endDate) console.log(`   End Date: ${endDate.toISOString().split("T")[0]}`)
  console.log()

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      transponderNumber: true,
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${userEmail}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✅ User found:`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Driver Name: ${user.driverName}`)
  console.log(`   Normalized Name: ${user.normalizedName || "(not set)"}`)
  console.log(`   Transponder: ${user.transponderNumber || "(not set)"}`)
  console.log()

  // Check track
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      trackName: true,
    },
  })

  if (!track) {
    console.error(`❌ Track not found: ${trackId}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✅ Track found: ${track.trackName}`)
  console.log()

  // Check events for track/date range (without driver filter)
  const whereClause: Prisma.EventWhereInput = { trackId }
  if (startDate && endDate) {
    whereClause.eventDate = {
      gte: startDate,
      lte: endDate,
    }
  }

  const allEvents = await prisma.event.findMany({
    where: whereClause,
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      eventEntries: true,
      eventDrivers: true,
      ingestDepth: true,
    },
  })

  console.log(`📊 Events for track/date range (without driver filter): ${allEvents.length}`)
  if (allEvents.length > 0) {
    allEvents.slice(0, 5).forEach((event) => {
      console.log(`   - ${event.eventName} (${event.eventDate?.toISOString().split("T")[0]})`)
      console.log(
        `     Entries: ${event.eventEntries}, Drivers: ${event.eventDrivers}, Ingest Depth: ${event.ingestDepth}`
      )
    })
    if (allEvents.length > 5) {
      console.log(`   ... and ${allEvents.length - 5} more`)
    }
  } else {
    console.log(`   ⚠️  No events found for this track/date range`)
  }
  console.log()

  // Check EventDriverLink records
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId: user.id,
      NOT: {
        userDriverLink: {
          status: "rejected",
        },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
          trackId: true,
        },
      },
      userDriverLink: {
        select: {
          status: true,
        },
      },
    },
  })

  console.log(`📊 EventDriverLink records for user: ${eventDriverLinks.length}`)

  // Filter to events in the track/date range
  const relevantLinks = eventDriverLinks.filter((link) => {
    if (link.event.trackId !== trackId) return false
    if (startDate && endDate && link.event.eventDate) {
      const eventDate = new Date(link.event.eventDate)
      return eventDate >= startDate && eventDate <= endDate
    }
    return true
  })

  console.log(`   Relevant to track/date range: ${relevantLinks.length}`)
  if (relevantLinks.length > 0) {
    relevantLinks.forEach((link) => {
      console.log(`   - ${link.event.eventName}`)
      console.log(`     Match Type: ${link.matchType}, Similarity: ${link.similarityScore}`)
      console.log(`     UserDriverLink Status: ${link.userDriverLink?.status || "N/A"}`)
    })
  }
  console.log()

  // Check EventEntry records for events in the range
  if (allEvents.length > 0) {
    const eventIds = allEvents.map((e) => e.id)
    const eventEntries = await prisma.eventEntry.findMany({
      where: {
        eventId: { in: eventIds },
      },
      include: {
        driver: {
          select: {
            id: true,
            displayName: true,
            normalizedName: true,
            transponderNumber: true,
          },
        },
      },
    })

    console.log(`📊 EventEntry records for events in range: ${eventEntries.length}`)

    // Check if any drivers match the user
    const { fuzzyMatchUserToDriver } = await import("../src/core/users/driver-matcher")
    let matchCount = 0

    for (const entry of eventEntries) {
      if (!entry.driver) continue

      const match = fuzzyMatchUserToDriver(
        {
          id: user.id,
          driverName: user.driverName,
          normalizedName: user.normalizedName,
          transponderNumber: user.transponderNumber,
        },
        {
          id: entry.driver.id,
          displayName: entry.driver.displayName,
          normalizedName: entry.driver.normalizedName,
          transponderNumber: entry.driver.transponderNumber,
        }
      )

      if (match) {
        matchCount++
        if (matchCount <= 5) {
          console.log(`   ✅ Match found: ${entry.driver.displayName}`)
          console.log(
            `      Match Type: ${match.matchType}, Similarity: ${match.similarityScore}, Status: ${match.status}`
          )
          const event = allEvents.find((e) => e.id === entry.eventId)
          if (event) {
            console.log(`      Event: ${event.eventName}`)
          }
        }
      }
    }

    if (matchCount > 5) {
      console.log(`   ... and ${matchCount - 5} more matches`)
    } else if (matchCount === 0) {
      console.log(`   ⚠️  No driver matches found in EventEntry records`)
    }
  }

  console.log()
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
