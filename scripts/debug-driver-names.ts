/**
 * Debug script to investigate driver name issues
 *
 * This script checks for drivers in the "Cormcc Club Day 20 July 2025" event
 * and identifies why some drivers might appear as "Unknown Driver"
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const eventName = "Cormcc Club Day 20 July 2025"

  console.log(`\n=== Searching for event: ${eventName} ===\n`)

  // Find the event
  const event = await prisma.event.findFirst({
    where: {
      eventName: {
        contains: eventName,
        mode: "insensitive",
      },
    },
    include: {
      races: {
        include: {
          results: {
            include: {
              raceDriver: {
                include: {
                  driver: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!event) {
    console.log("Event not found!")
    return
  }

  console.log(`Found event: ${event.eventName} (ID: ${event.id})`)
  console.log(`Event date: ${event.eventDate}`)
  console.log(`\n=== Races ===\n`)

  // Check each race
  for (const race of event.races) {
    console.log(`\nRace: ${race.raceLabel} (${race.className})`)
    console.log(`Race ID: ${race.id}`)
    console.log(`Results count: ${race.results.length}`)

    // Check for "Jayson Brenton" or similar
    const jaysonResults = race.results.filter(
      (r) =>
        r.raceDriver.displayName.toLowerCase().includes("jayson") ||
        r.raceDriver.displayName.toLowerCase().includes("brenton")
    )

    if (jaysonResults.length > 0) {
      console.log(`\n*** Found Jayson Brenton results in this race! ***`)
      for (const result of jaysonResults) {
        console.log(`\n  Result ID: ${result.id}`)
        console.log(`  Position: ${result.positionFinal}`)
        console.log(`  Laps: ${result.lapsCompleted}`)
        console.log(`  Fast Lap: ${result.fastLapTime}`)
        console.log(`  RaceDriver ID: ${result.raceDriverId}`)
        console.log(`  RaceDriver displayName: "${result.raceDriver.displayName}"`)
        console.log(`  RaceDriver driverId: ${result.raceDriver.driverId}`)
        console.log(`  RaceDriver sourceDriverId: ${result.raceDriver.sourceDriverId}`)
        console.log(`  Driver ID: ${result.raceDriver.driver.id}`)
        console.log(`  Driver displayName: "${result.raceDriver.driver.displayName}"`)
        console.log(`  Driver sourceDriverId: ${result.raceDriver.driver.sourceDriverId}`)
        console.log(`  Driver normalizedName: "${result.raceDriver.driver.normalizedName}"`)
      }
    }

    // Check for any results with missing or empty displayName
    const missingNames = race.results.filter(
      (r) => !r.raceDriver.displayName || r.raceDriver.displayName.trim() === ""
    )

    if (missingNames.length > 0) {
      console.log(
        `\n  *** WARNING: ${missingNames.length} results with missing/empty displayName ***`
      )
      for (const result of missingNames) {
        console.log(`    Result ID: ${result.id}, RaceDriver ID: ${result.raceDriverId}`)
      }
    }
  }

  // Now check all drivers in the event
  console.log(`\n\n=== All Drivers in Event ===\n`)

  const allRaceDrivers = await prisma.raceDriver.findMany({
    where: {
      race: {
        eventId: event.id,
      },
    },
    include: {
      driver: true,
      race: true,
    },
  })

  // Group by driverId
  const driversByDriverId = new Map<string, typeof allRaceDrivers>()
  for (const rd of allRaceDrivers) {
    const driverId = rd.driverId
    if (!driversByDriverId.has(driverId)) {
      driversByDriverId.set(driverId, [])
    }
    driversByDriverId.get(driverId)!.push(rd)
  }

  console.log(`Total unique drivers (by driverId): ${driversByDriverId.size}`)

  // Check for "Jayson Brenton"
  for (const [driverId, raceDrivers] of driversByDriverId.entries()) {
    const firstRd = raceDrivers[0]
    const driverName = firstRd.driver.displayName
    const normalizedName = firstRd.driver.normalizedName

    if (
      driverName.toLowerCase().includes("jayson") ||
      driverName.toLowerCase().includes("brenton") ||
      (normalizedName &&
        (normalizedName.toLowerCase().includes("jayson") ||
          normalizedName.toLowerCase().includes("brenton")))
    ) {
      console.log(`\n*** Found Jayson Brenton driver! ***`)
      console.log(`  Driver ID: ${driverId}`)
      console.log(`  Driver displayName: "${driverName}"`)
      console.log(`  Driver normalizedName: "${normalizedName}"`)
      console.log(`  Driver sourceDriverId: ${firstRd.driver.sourceDriverId}`)
      console.log(`  Appears in ${raceDrivers.length} race(s):`)

      for (const rd of raceDrivers) {
        console.log(`    - ${rd.race.raceLabel} (${rd.race.className})`)
        console.log(`      RaceDriver ID: ${rd.id}`)
        console.log(`      RaceDriver displayName: "${rd.displayName}"`)
        console.log(`      RaceDriver sourceDriverId: ${rd.sourceDriverId}`)
      }
    }
  }

  // Check for duplicate driverIds with different names
  console.log(`\n\n=== Checking for driver name inconsistencies ===\n`)

  for (const [driverId, raceDrivers] of driversByDriverId.entries()) {
    const uniqueNames = new Set(raceDrivers.map((rd) => rd.displayName))
    if (uniqueNames.size > 1) {
      console.log(`\n  WARNING: Driver ID ${driverId} has multiple displayNames:`)
      for (const name of uniqueNames) {
        console.log(`    - "${name}"`)
      }
    }

    const uniqueDriverNames = new Set(raceDrivers.map((rd) => rd.driver.displayName))
    if (uniqueDriverNames.size > 1) {
      console.log(`\n  WARNING: Driver ID ${driverId} has multiple Driver.displayNames:`)
      for (const name of uniqueDriverNames) {
        console.log(`    - "${name}"`)
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
