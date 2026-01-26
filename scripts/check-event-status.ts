import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Get current user (assuming first user for testing)
  const user = await prisma.user.findFirst({
    select: {
      id: true,
      driverName: true,
      normalizedName: true,
    },
  })

  if (!user) {
    console.log("No user found")
    return
  }

  console.log(`\n=== User Info ===`)
  console.log(`User ID: ${user.id}`)
  console.log(`Driver Name: ${user.driverName}`)
  console.log(`Normalized Name: ${user.normalizedName || "NULL"}`)

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { eventName: { contains: "Batemans Bay" } },
        { eventName: { contains: "Cormcc" } },
      ],
    },
    include: {
      driverLinks: {
        where: {
          userId: user.id,
        },
        include: {
          driver: true,
          user: {
            select: {
              id: true,
              driverName: true,
              normalizedName: true,
            },
          },
          userDriverLink: {
            select: {
              id: true,
              status: true,
              similarityScore: true,
              confirmedAt: true,
              rejectedAt: true,
            },
          },
        },
      },
      entries: {
        where: {
          driver: {
            normalizedName: user.normalizedName || user.driverName.toUpperCase().trim(),
          },
        },
        include: {
          driver: {
            select: {
              id: true,
              displayName: true,
              normalizedName: true,
            },
          },
        },
      },
    },
  })

  for (const event of events) {
    console.log(`\n=== Event: ${event.eventName} ===`)
    console.log(`Event ID: ${event.id}`)
    console.log(`EventDriverLink Count: ${event.driverLinks.length}`)
    console.log(`EventEntry Count: ${event.entries.length}`)
    
    if (event.driverLinks.length > 0) {
      console.log(`\n  --- EventDriverLink Records ---`)
      for (const link of event.driverLinks) {
        console.log(`\n  EventDriverLink ID: ${link.id}`)
        console.log(`  Match Type: ${link.matchType}`)
        console.log(`  Similarity Score: ${link.similarityScore}`)
        console.log(`  Driver: ${link.driver.displayName}`)
        console.log(`  User: ${link.user.driverName} (normalized: ${link.user.normalizedName})`)
        console.log(`  UserDriverLinkId (from EventDriverLink): ${link.userDriverLinkId || "NULL"}`)
        
        if (link.userDriverLink) {
          console.log(`  UserDriverLink ID: ${link.userDriverLink.id}`)
          console.log(`  UserDriverLink Status: ${link.userDriverLink.status}`)
          console.log(`  UserDriverLink Similarity Score: ${link.userDriverLink.similarityScore}`)
          console.log(`  Confirmed At: ${link.userDriverLink.confirmedAt}`)
          console.log(`  Rejected At: ${link.userDriverLink.rejectedAt}`)
        } else {
          console.log(`  UserDriverLink: NULL (not created yet)`)
          console.log(`  This means the EventDriverLink exists but no UserDriverLink was created`)
        }
      }
    }
    
    if (event.entries.length > 0) {
      console.log(`\n  --- EventEntry Records (Method 2 match) ---`)
      for (const entry of event.entries) {
        console.log(`\n  EventEntry ID: ${entry.id}`)
        console.log(`  Driver: ${entry.driver.displayName} (normalized: ${entry.driver.normalizedName})`)
        console.log(`  Class Name: ${entry.className}`)
        console.log(`  This entry would show as: matchType="exact", similarityScore=1.0, status="suggested"`)
      }
    }
    
    if (event.driverLinks.length === 0 && event.entries.length === 0) {
      console.log(`  No matches found for this event (neither EventDriverLink nor EventEntry)`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
