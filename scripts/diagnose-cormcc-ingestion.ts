import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Get both events
  const batemansBay = await prisma.event.findFirst({
    where: {
      eventName: { contains: "Batemans Bay" },
    },
    include: {
      entries: {
        include: {
          driver: true,
        },
      },
    },
  })

  const cormcc = await prisma.event.findFirst({
    where: {
      eventName: { contains: "Cormcc" },
    },
    include: {
      entries: {
        include: {
          driver: true,
        },
      },
    },
  })

  console.log("\n=== Batemans Bay Rawspeed 2025 ===")
  if (batemansBay) {
    console.log(`Event ID: ${batemansBay.id}`)
    console.log(`Ingest Depth: ${batemansBay.ingestDepth}`)
    console.log(`Last Ingested At: ${batemansBay.lastIngestedAt}`)
    console.log(`Created At: ${batemansBay.createdAt}`)
    console.log(`Updated At: ${batemansBay.updatedAt}`)
    console.log(`Event Entries Count: ${batemansBay.entries.length}`)

    const driver = batemansBay.entries[0]?.driver
    if (driver) {
      console.log(`\nFirst Entry Driver:`)
      console.log(`  Driver ID: ${driver.id}`)
      console.log(`  Display Name: ${driver.displayName}`)
      console.log(`  Normalized Name: ${driver.normalizedName || "NULL"}`)
      console.log(`  Source: ${driver.source}`)
      console.log(`  Source Driver ID: ${driver.sourceDriverId}`)
      console.log(`  Created At: ${driver.createdAt}`)
      console.log(`  Updated At: ${driver.updatedAt}`)
    }
  }

  console.log("\n=== Cormcc Club Day 20 July 2025 ===")
  if (cormcc) {
    console.log(`Event ID: ${cormcc.id}`)
    console.log(`Ingest Depth: ${cormcc.ingestDepth}`)
    console.log(`Last Ingested At: ${cormcc.lastIngestedAt}`)
    console.log(`Created At: ${cormcc.createdAt}`)
    console.log(`Updated At: ${cormcc.updatedAt}`)
    console.log(`Event Entries Count: ${cormcc.entries.length}`)

    const driver = cormcc.entries[0]?.driver
    if (driver) {
      console.log(`\nFirst Entry Driver:`)
      console.log(`  Driver ID: ${driver.id}`)
      console.log(`  Display Name: ${driver.displayName}`)
      console.log(`  Normalized Name: ${driver.normalizedName || "NULL"}`)
      console.log(`  Source: ${driver.source}`)
      console.log(`  Source Driver ID: ${driver.sourceDriverId}`)
      console.log(`  Created At: ${driver.createdAt}`)
      console.log(`  Updated At: ${driver.updatedAt}`)
    }
  }

  // Find the user's driver in each event
  const user = await prisma.user.findFirst({
    select: {
      id: true,
      driverName: true,
      normalizedName: true,
    },
  })

  if (user) {
    console.log(`\n=== User Info ===`)
    console.log(`User Driver Name: ${user.driverName}`)
    console.log(`User Normalized Name: ${user.normalizedName || "NULL"}`)

    // Find matching drivers
    const userNormalized = user.normalizedName || user.driverName.toUpperCase().trim()

    if (batemansBay) {
      const matchingDriver = batemansBay.entries.find(
        (entry) => entry.driver.normalizedName === userNormalized
      )?.driver

      console.log(`\n=== Batemans Bay - User's Driver ===`)
      if (matchingDriver) {
        console.log(`Driver ID: ${matchingDriver.id}`)
        console.log(`Display Name: ${matchingDriver.displayName}`)
        console.log(`Normalized Name: ${matchingDriver.normalizedName}`)
        console.log(`Created At: ${matchingDriver.createdAt}`)
        console.log(`Updated At: ${matchingDriver.updatedAt}`)
      } else {
        console.log("No matching driver found in entries")
      }
    }

    if (cormcc) {
      const matchingDriver = cormcc.entries.find(
        (entry) => entry.driver.normalizedName === userNormalized
      )?.driver

      console.log(`\n=== Cormcc - User's Driver ===`)
      if (matchingDriver) {
        console.log(`Driver ID: ${matchingDriver.id}`)
        console.log(`Display Name: ${matchingDriver.displayName}`)
        console.log(`Normalized Name: ${matchingDriver.normalizedName}`)
        console.log(`Created At: ${matchingDriver.createdAt}`)
        console.log(`Updated At: ${matchingDriver.updatedAt}`)
      } else {
        console.log("No matching driver found in entries")
      }
    }
  }

  // Check UserDriverLink for the driver
  if (batemansBay && cormcc) {
    const batemansDriver = batemansBay.entries[0]?.driver
    const cormccDriver = cormcc.entries[0]?.driver

    if (batemansDriver) {
      const userDriverLink = await prisma.userDriverLink.findFirst({
        where: {
          driverId: batemansDriver.id,
        },
      })
      console.log("\n=== UserDriverLink for Batemans Driver ===")
      if (userDriverLink) {
        console.log(`UserDriverLink ID: ${userDriverLink.id}`)
        console.log(`Status: ${userDriverLink.status}`)
        console.log(`Created At: ${userDriverLink.createdAt}`)
        console.log(`Matched At: ${userDriverLink.matchedAt}`)
        console.log(`Confirmed At: ${userDriverLink.confirmedAt}`)
      } else {
        console.log("No UserDriverLink found")
      }
    }

    if (cormccDriver) {
      const userDriverLink = await prisma.userDriverLink.findFirst({
        where: {
          driverId: cormccDriver.id,
        },
      })
      console.log("\n=== UserDriverLink for Cormcc Driver ===")
      if (userDriverLink) {
        console.log(`UserDriverLink ID: ${userDriverLink.id}`)
        console.log(`Status: ${userDriverLink.status}`)
        console.log(`Created At: ${userDriverLink.createdAt}`)
        console.log(`Matched At: ${userDriverLink.matchedAt}`)
        console.log(`Confirmed At: ${userDriverLink.confirmedAt}`)
      } else {
        console.log("No UserDriverLink found")
      }
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
