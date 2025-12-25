import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const eventId = '67affaa1-f667-4d22-9621-9d1cc189f7a0'
  
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      races: {
        include: {
          drivers: {
            include: {
              driver: true,
            },
            take: 5,
          },
        },
        take: 2,
      },
    },
  })

  if (!event) {
    console.error('Event not found')
    process.exit(1)
  }

  console.log(`Event: ${event.eventName}`)
  console.log(`Races: ${event.races.length}`)
  console.log('')

  let totalRaceDrivers = 0
  let driversWithTransponders = 0
  let raceDriversWithTransponders = 0

  for (const race of event.races) {
    console.log(`Race: ${race.className} - ${race.raceLabel}`)
    console.log(`  Drivers: ${race.drivers.length}`)
    
    for (const raceDriver of race.drivers) {
      totalRaceDrivers++
      const driverTransponder = raceDriver.driver.transponderNumber
      const raceDriverTransponder = raceDriver.transponderNumber
      const transponder = raceDriverTransponder || driverTransponder
      
      if (driverTransponder) driversWithTransponders++
      if (raceDriverTransponder) raceDriversWithTransponders++
      
      console.log(`    - ${raceDriver.displayName}: ${transponder || 'None'}`)
      if (raceDriverTransponder && driverTransponder && raceDriverTransponder !== driverTransponder) {
        console.log(`      (Driver: ${driverTransponder}, Race: ${raceDriverTransponder})`)
      }
    }
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Race Drivers: ${totalRaceDrivers}`)
  console.log(`Drivers with transponder (Driver level): ${driversWithTransponders}`)
  console.log(`Race Drivers with transponder (RaceDriver level): ${raceDriversWithTransponders}`)
  
  if (raceDriversWithTransponders > 0 || driversWithTransponders > 0) {
    console.log('\n✓ SUCCESS: Transponder numbers are present!')
  } else {
    console.log('\n⚠ No transponder numbers found. This event may not have an entry list available.')
  }

  await prisma.$disconnect()
}

main().catch(console.error)

