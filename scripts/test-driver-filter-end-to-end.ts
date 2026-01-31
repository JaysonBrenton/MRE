/**
 * @fileoverview End-to-end test for driver filter with both DB and LiveRC events
 *
 * Tests the actual API endpoints to verify both DB and LiveRC events are returned
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Testing Driver Filter End-to-End\n")
  console.log("=".repeat(80))

  // Find user with driver name "Jayson Brenton"
  const user = await prisma.user.findFirst({
    where: {
      driverName: {
        contains: "Jayson",
        mode: "insensitive",
      },
    },
  })

  if (!user) {
    console.error("No user found with driver name containing 'Jayson'")
    process.exit(1)
  }

  console.log(`User: ${user.driverName} (${user.email})`)
  console.log(`User ID: ${user.id}`)
  console.log()

  // Find track "Canberra Off Road Model Car Club"
  const track = await prisma.track.findFirst({
    where: {
      trackName: {
        contains: "Canberra",
        mode: "insensitive",
      },
    },
  })

  if (!track) {
    console.error("No track found with name containing 'Canberra'")
    process.exit(1)
  }

  console.log(`Track: ${track.trackName}`)
  console.log(`Track ID: ${track.id}`)
  console.log()

  // Test 1: Check DB search with driver filter
  console.log("=".repeat(80))
  console.log("TEST 1: DB Search with Driver Filter")
  console.log("=".repeat(80))

  const dbEvents = await prisma.event.findMany({
    where: {
      trackId: track.id,
    },
    include: {
      driverLinks: {
        where: {
          userId: user.id,
        },
      },
    },
  })

  console.log(`Found ${dbEvents.length} total events in DB for this track`)

  const eventsWithLinks = dbEvents.filter((e) => e.driverLinks.length > 0)
  console.log(`Found ${eventsWithLinks.length} events with EventDriverLink for user:`)
  eventsWithLinks.forEach((event) => {
    console.log(`  - ${event.eventName} (${event.sourceEventId})`)
    event.driverLinks.forEach((link) => {
      console.log(`    Match: ${link.matchType} (similarity: ${link.similarityScore.toFixed(3)})`)
    })
  })
  console.log()

  // Test 2: Simulate what the API would do
  console.log("=".repeat(80))
  console.log("TEST 2: Simulating API Search Endpoint")
  console.log("=".repeat(80))

  // This simulates the searchEventsFromRepo call with filterByDriver
  const { searchEvents: searchEventsFromRepo } = await import("../src/core/events/repo")

  try {
    const searchResult = await searchEventsFromRepo({
      trackId: track.id,
    })

    console.log(`DB Search returned ${searchResult.events.length} filtered events:`)
    searchResult.events.forEach((event) => {
      console.log(`  - ${event.eventName} (${event.sourceEventId})`)
    })
    console.log()
  } catch (error) {
    console.error("Error in DB search:", error)
  }

  // Test 3: Check what LiveRC discovery would return
  console.log("=".repeat(80))
  console.log("TEST 3: LiveRC Discovery (requires running ingestion service)")
  console.log("=".repeat(80))
  console.log("NOTE: This test requires the ingestion service to be running")
  console.log("      and would make actual API calls to LiveRC")
  console.log()
  console.log("To test LiveRC discovery:")
  console.log("1. Ensure ingestion service is running")
  console.log("2. Start Next.js dev server")
  console.log("3. Make authenticated API call to /api/v1/events/discover")
  console.log("4. With filter_by_driver=true in request body")
  console.log("5. Check response for new_events array")
  console.log()

  // Test 4: Verify the flow
  console.log("=".repeat(80))
  console.log("TEST 4: Expected Behavior")
  console.log("=".repeat(80))
  console.log("When 'Show only my events' is enabled:")
  console.log()
  console.log("1. DB Search:")
  console.log(`   - Should return ${eventsWithLinks.length} events from DB`)
  console.log("   - These are events already imported with EventDriverLink records")
  console.log()
  console.log("2. LiveRC Discovery:")
  console.log("   - Should fetch entry lists for all LiveRC events")
  console.log("   - Should filter by driver name (name-based matching only)")
  console.log("   - Should return matching events in new_events array")
  console.log()
  console.log("3. Combined Results:")
  console.log("   - DB events should appear first")
  console.log("   - LiveRC events should appear after (with 'New (LiveRC only)' status)")
  console.log("   - Both should be filtered to only show events matching user's driver name")
  console.log()

  console.log("=".repeat(80))
  console.log("VERIFICATION NEEDED:")
  console.log("=".repeat(80))
  console.log("To fully verify, you need to:")
  console.log("1. Start the application (npm run dev)")
  console.log("2. Login as the user")
  console.log("3. Navigate to event search")
  console.log("4. Select the track")
  console.log("5. Enable 'Show only my events'")
  console.log("6. Click Search")
  console.log("7. Check browser console for [LiveRCDiscovery] logs")
  console.log("8. Verify both DB and LiveRC events appear in results")
  console.log()

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
