import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Drivers from the screenshot that have missing fastest lap
  const driverNames = [
    'STEVE PERRY',
    'TONY ROBERTS',
    'HARRISON TURNER',
    'LIAM KEOWN-SMITH',
  ]

  console.log('=== Checking Drivers with Missing Fastest Lap Times ===\n')

  for (const driverName of driverNames) {
    console.log(`\n--- ${driverName} ---`)

    // Find drivers with matching display names (case insensitive, partial match)
    const drivers = await prisma.driver.findMany({
      where: {
        displayName: {
          contains: driverName.split(' - ')[0].split(' * ')[0], // Remove suffixes
          mode: 'insensitive'
        }
      },
      include: {
        raceDrivers: {
          include: {
            race: {
              include: {
                event: {
                  select: {
                    eventName: true,
                    eventDate: true,
                  }
                }
              }
            },
            results: {
              include: {
                laps: true
              }
            }
          }
        }
      }
    })

    if (drivers.length === 0) {
      console.log(`  No drivers found matching "${driverName}"`)
      continue
    }

    for (const driver of drivers) {
      console.log(`  Driver ID: ${driver.id}`)
      console.log(`  Display Name: ${driver.displayName}`)
      console.log(`  Source Driver ID: ${driver.sourceDriverId}`)

      // Check all race results for this driver
      let hasAnyLaps = false
      let hasFastestLap = false
      const raceResults: Array<{
        raceUrl: string
        className: string
        fastLapTime: number | null
        lapCount: number
        lapsCompleted: number
        eventName: string
      }> = []

      for (const raceDriver of driver.raceDrivers) {
        for (const result of raceDriver.results) {
          const lapCount = result.laps.length
          if (lapCount > 0) {
            hasAnyLaps = true
          }
          if (result.fastLapTime !== null) {
            hasFastestLap = true
          }

          raceResults.push({
            raceUrl: raceDriver.race.raceUrl,
            className: raceDriver.race.className,
            fastLapTime: result.fastLapTime,
            lapCount: lapCount,
            lapsCompleted: result.lapsCompleted,
            eventName: raceDriver.race.event.eventName,
          })
        }
      }

      console.log(`  Total Race Results: ${raceResults.length}`)
      console.log(`  Has Any Laps: ${hasAnyLaps}`)
      console.log(`  Has Fastest Lap in Any Race: ${hasFastestLap}`)

      // Show results without fastest lap
      const resultsWithoutFastLap = raceResults.filter(r => r.fastLapTime === null)
      console.log(`  Results WITHOUT fastest lap: ${resultsWithoutFastLap.length}`)

      if (resultsWithoutFastLap.length > 0) {
        console.log('\n  Race Results WITHOUT fastest lap:')
        for (const result of resultsWithoutFastLap.slice(0, 5)) {
          console.log(`    - ${result.eventName} - ${result.className}`)
          console.log(`      Laps Completed: ${result.lapsCompleted}`)
          console.log(`      Lap Records in DB: ${result.lapCount}`)
          console.log(`      LiveRC URL: ${result.raceUrl}`)
          console.log('')
        }
        if (resultsWithoutFastLap.length > 5) {
          console.log(`    ... and ${resultsWithoutFastLap.length - 5} more`)
        }
      }

      // Show one example with lap data but no fastest lap
      const exampleWithLapsButNoFastLap = resultsWithoutFastLap.find(r => r.lapCount > 0)
      if (exampleWithLapsButNoFastLap) {
        console.log('\n  ⭐ EXAMPLE: Race with lap data but no fastest lap:')
        console.log(`    LiveRC URL: ${exampleWithLapsButNoFastLap.raceUrl}`)
        console.log(`    Class: ${exampleWithLapsButNoFastLap.className}`)
        console.log(`    Laps in DB: ${exampleWithLapsButNoFastLap.lapCount}`)
        console.log(`    Laps Completed: ${exampleWithLapsButNoFastLap.lapsCompleted}`)
      } else {
        console.log('\n  ℹ️  All results without fastest lap also have 0 laps (non-starting/DNF drivers)')
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log('Check the LiveRC URLs above to see why fastest lap times are missing.')
}

main()
  .catch((e) => {
    console.error('Error querying database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

