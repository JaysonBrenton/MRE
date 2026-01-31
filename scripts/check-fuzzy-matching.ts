import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const userEmail = process.argv[2] || "jaysoncareybrenton@gmail.com"
  const eventName = process.argv[3] || "Cormcc Club Day 20 July 2025"
  const driverName = process.argv[4] || "Jayson Brenton"

  console.log(`\nChecking fuzzy matching results:`)
  console.log(`  User Email: ${userEmail}`)
  console.log(`  Event Name: ${eventName}`)
  console.log(`  Driver Name: ${driverName}\n`)

  // Find the user
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

  console.log(`✅ Found user:`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Driver Name: ${user.driverName}`)
  console.log(`   Normalized Name: ${user.normalizedName || "(not set)"}`)
  console.log(`   Transponder: ${user.transponderNumber || "(not set)"}\n`)

  // Find the event
  const event = await prisma.event.findFirst({
    where: {
      eventName: {
        contains: eventName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      trackId: true,
    },
  })

  if (!event) {
    console.error(`❌ Event not found: ${eventName}`)
    console.log(`\nAvailable events with similar names:`)
    const similarEvents = await prisma.event.findMany({
      where: {
        eventName: {
          contains: eventName.split(" ")[0], // Search by first word
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        eventName: true,
        eventDate: true,
      },
      take: 10,
    })
    similarEvents.forEach((e) => {
      console.log(`   - ${e.eventName} (${e.eventDate.toISOString().split("T")[0]})`)
    })
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✅ Found event:`)
  console.log(`   ID: ${event.id}`)
  console.log(`   Name: ${event.eventName}`)
  console.log(`   Date: ${event.eventDate.toISOString().split("T")[0]}\n`)

  // Find the driver in this event
  const eventEntry = await prisma.eventEntry.findFirst({
    where: {
      eventId: event.id,
      driver: {
        displayName: {
          contains: driverName,
          mode: "insensitive",
        },
      },
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

  if (!eventEntry) {
    console.error(`❌ Driver "${driverName}" not found in event "${event.eventName}"`)
    console.log(`\nDrivers in this event:`)
    const drivers = await prisma.eventEntry.findMany({
      where: { eventId: event.id },
      include: {
        driver: {
          select: {
            displayName: true,
          },
        },
      },
      take: 20,
    })
    drivers.forEach((entry) => {
      console.log(`   - ${entry.driver.displayName}`)
    })
    await prisma.$disconnect()
    process.exit(1)
  }

  const driver = eventEntry.driver
  console.log(`✅ Found driver:`)
  console.log(`   ID: ${driver.id}`)
  console.log(`   Display Name: ${driver.displayName}`)
  console.log(`   Normalized Name: ${driver.normalizedName || "(not set)"}`)
  console.log(`   Transponder: ${driver.transponderNumber || "(not set)"}\n`)

  // Check UserDriverLink
  const userDriverLink = await prisma.userDriverLink.findUnique({
    where: {
      userId_driverId: {
        userId: user.id,
        driverId: driver.id,
      },
    },
    include: {
      events: {
        where: {
          eventId: event.id,
        },
        select: {
          id: true,
          eventId: true,
          matchType: true,
          similarityScore: true,
          transponderNumber: true,
          matchedAt: true,
        },
      },
    },
  })

  if (!userDriverLink) {
    console.log(`❌ No UserDriverLink found for this user-driver combination`)
    console.log(`\nThis means fuzzy matching did NOT create a link.`)
    console.log(`Possible reasons:`)
    console.log(`   - Similarity score was below 0.85 threshold`)
    console.log(`   - Driver already linked to another user`)
    console.log(`   - Matching was skipped for some reason\n`)
  } else {
    console.log(`✅ Found UserDriverLink:`)
    console.log(`   Status: ${userDriverLink.status}`)
    console.log(`   Similarity Score: ${userDriverLink.similarityScore}`)
    console.log(
      `   Match Type (from matcher): ${userDriverLink.matcherId} v${userDriverLink.matcherVersion}`
    )
    console.log(`   Matched At: ${userDriverLink.matchedAt.toISOString()}`)
    if (userDriverLink.confirmedAt) {
      console.log(`   Confirmed At: ${userDriverLink.confirmedAt.toISOString()}`)
    }
    if (userDriverLink.rejectedAt) {
      console.log(`   Rejected At: ${userDriverLink.rejectedAt.toISOString()}`)
    }
    if (userDriverLink.conflictReason) {
      console.log(`   Conflict Reason: ${userDriverLink.conflictReason}`)
    }
    console.log(`\n   EventDriverLink for this event:`)
    if (userDriverLink.events.length === 0) {
      console.log(`   ⚠️  No EventDriverLink found for this specific event`)
    } else {
      userDriverLink.events.forEach((eventLink) => {
        console.log(`   ✅ EventDriverLink:`)
        console.log(`      Match Type: ${eventLink.matchType}`)
        console.log(`      Similarity Score: ${eventLink.similarityScore}`)
        console.log(`      Transponder: ${eventLink.transponderNumber || "(not set)"}`)
        console.log(`      Matched At: ${eventLink.matchedAt.toISOString()}`)
      })
    }
  }

  // Also check all EventDriverLinks for this user-driver combination
  const allEventLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId: user.id,
      driverId: driver.id,
    },
    include: {
      event: {
        select: {
          eventName: true,
          eventDate: true,
        },
      },
    },
    orderBy: {
      matchedAt: "desc",
    },
  })

  if (allEventLinks.length > 0) {
    console.log(`\n📊 All EventDriverLinks for this user-driver combination:`)
    allEventLinks.forEach((link) => {
      console.log(
        `   - ${link.event.eventName} (${link.event.eventDate.toISOString().split("T")[0]})`
      )
      console.log(`     Match Type: ${link.matchType}, Score: ${link.similarityScore}`)
    })
  }

  console.log(`\n`)
}

main()
  .catch((e) => {
    console.error("Error querying database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
