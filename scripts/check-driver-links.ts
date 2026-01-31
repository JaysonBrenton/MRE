import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
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

  const userNormalized = user.normalizedName || "brenton jayson"

  // Get the driver for this user
  const driver = await prisma.driver.findFirst({
    where: {
      normalizedName: userNormalized,
    },
  })

  if (!driver) {
    console.log("No driver found with normalized name:", userNormalized)
    return
  }

  console.log(`\n=== User's Driver ===`)
  console.log(`Driver ID: ${driver.id}`)
  console.log(`Display Name: ${driver.displayName}`)
  console.log(`Normalized Name: ${driver.normalizedName}`)

  // Check UserDriverLink
  const userDriverLink = await prisma.userDriverLink.findFirst({
    where: {
      driverId: driver.id,
      userId: user.id,
    },
  })

  console.log(`\n=== UserDriverLink ===`)
  if (userDriverLink) {
    console.log(`UserDriverLink ID: ${userDriverLink.id}`)
    console.log(`Status: ${userDriverLink.status}`)
    console.log(`Created At: ${userDriverLink.createdAt}`)
    console.log(`Matched At: ${userDriverLink.matchedAt}`)
  } else {
    console.log("No UserDriverLink found")
  }

  // Check EventDriverLinks for this driver
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      driverId: driver.id,
      userId: user.id,
    },
    include: {
      event: {
        select: {
          id: true,
          eventName: true,
        },
      },
    },
  })

  console.log(`\n=== EventDriverLinks ===`)
  console.log(`Count: ${eventDriverLinks.length}`)
  for (const link of eventDriverLinks) {
    console.log(`\n  Event: ${link.event.eventName}`)
    console.log(`  EventDriverLink ID: ${link.id}`)
    console.log(`  Match Type: ${link.matchType}`)
    console.log(`  Similarity Score: ${link.similarityScore}`)
    console.log(`  Created At: ${link.createdAt}`)
    console.log(`  Matched At: ${link.matchedAt}`)
  }

  // Check if there are multiple drivers with the same normalized name
  const allDriversWithName = await prisma.driver.findMany({
    where: {
      normalizedName: userNormalized,
    },
  })

  console.log(`\n=== All Drivers with Normalized Name "${userNormalized}" ===`)
  console.log(`Count: ${allDriversWithName.length}`)
  for (const d of allDriversWithName) {
    console.log(`\n  Driver ID: ${d.id}`)
    console.log(`  Display Name: ${d.displayName}`)
    console.log(`  Source: ${d.source}`)
    console.log(`  Source Driver ID: ${d.sourceDriverId}`)
    console.log(`  Created At: ${d.createdAt}`)

    // Check EventDriverLinks for this specific driver
    const links = await prisma.eventDriverLink.findMany({
      where: {
        driverId: d.id,
        userId: user.id,
      },
      include: {
        event: {
          select: {
            eventName: true,
          },
        },
      },
    })
    console.log(`  EventDriverLinks: ${links.length}`)
    for (const link of links) {
      console.log(
        `    - ${link.event.eventName} (${link.matchType}, score: ${link.similarityScore})`
      )
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
