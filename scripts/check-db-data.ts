import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== MRE Database Contents ===\n')

  // Users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      driverName: true,
      teamName: true,
      isAdmin: true,
      createdAt: true,
    },
  })
  console.log(`Users: ${users.length}`)
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.driverName})${user.isAdmin ? ' [ADMIN]' : ''}`)
    console.log(`    Created: ${user.createdAt.toISOString()}`)
  })
  console.log()

  // Tracks
  const tracks = await prisma.track.findMany({
    include: {
      events: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
        },
      },
    },
  })
  console.log(`Tracks: ${tracks.length}`)
  tracks.forEach((track) => {
    console.log(`  - ${track.trackName} (${track.sourceTrackSlug})`)
    console.log(`    Source: ${track.source}`)
    console.log(`    Active: ${track.isActive}, Followed: ${track.isFollowed}`)
    console.log(`    Events: ${track.events.length}`)
    if (track.events.length > 0) {
      track.events.forEach((event) => {
        console.log(`      • ${event.eventName} (${event.eventDate.toISOString().split('T')[0]})`)
      })
    }
  })
  console.log()

  // Events
  const events = await prisma.event.findMany({
    include: {
      track: {
        select: {
          trackName: true,
        },
      },
      races: {
        select: {
          id: true,
          className: true,
          raceLabel: true,
        },
      },
    },
  })
  console.log(`Events: ${events.length}`)
  events.forEach((event) => {
    console.log(`  - ${event.eventName} (${event.track.trackName})`)
    console.log(`    Date: ${event.eventDate.toISOString().split('T')[0]}`)
    console.log(`    Source ID: ${event.sourceEventId}`)
    console.log(`    Ingest Depth: ${event.ingestDepth}`)
    console.log(`    Races: ${event.races.length}`)
    if (event.races.length > 0) {
      event.races.forEach((race) => {
        console.log(`      • ${race.className} - ${race.raceLabel}`)
      })
    }
  })
  console.log()

  // Races
  const races = await prisma.race.findMany({
    include: {
      event: {
        select: {
          eventName: true,
        },
      },
      drivers: {
        select: {
          id: true,
          displayName: true,
        },
      },
      results: {
        select: {
          id: true,
          positionFinal: true,
        },
      },
    },
  })
  console.log(`Races: ${races.length}`)
  races.forEach((race) => {
    console.log(`  - ${race.className} - ${race.raceLabel} (${race.event.eventName})`)
    console.log(`    Drivers: ${race.drivers.length}, Results: ${race.results.length}`)
  })
  console.log()

  // Race Drivers
  const raceDrivers = await prisma.raceDriver.findMany({
    include: {
      race: {
        select: {
          className: true,
          raceLabel: true,
        },
      },
    },
  })
  console.log(`Race Drivers: ${raceDrivers.length}`)
  if (raceDrivers.length > 0) {
    raceDrivers.slice(0, 10).forEach((driver) => {
      console.log(`  - ${driver.displayName} (${driver.race.className})`)
    })
    if (raceDrivers.length > 10) {
      console.log(`  ... and ${raceDrivers.length - 10} more`)
    }
  }
  console.log()

  // Race Results
  const raceResults = await prisma.raceResult.findMany({
    include: {
      race: {
        select: {
          className: true,
          raceLabel: true,
        },
      },
      raceDriver: {
        select: {
          displayName: true,
        },
      },
      laps: {
        select: {
          id: true,
        },
      },
    },
  })
  console.log(`Race Results: ${raceResults.length}`)
  if (raceResults.length > 0) {
    raceResults.slice(0, 10).forEach((result) => {
      console.log(`  - ${result.raceDriver.displayName}: Position ${result.positionFinal}, ${result.lapsCompleted} laps, ${result.laps.length} lap records`)
    })
    if (raceResults.length > 10) {
      console.log(`  ... and ${raceResults.length - 10} more`)
    }
  }
  console.log()

  // Laps
  const lapCount = await prisma.lap.count()
  console.log(`Laps: ${lapCount}`)
  console.log()

  // Summary
  console.log('=== Summary ===')
  console.log(`Total Users: ${users.length}`)
  console.log(`Total Tracks: ${tracks.length}`)
  console.log(`Total Events: ${events.length}`)
  console.log(`Total Races: ${races.length}`)
  console.log(`Total Race Drivers: ${raceDrivers.length}`)
  console.log(`Total Race Results: ${raceResults.length}`)
  console.log(`Total Laps: ${lapCount}`)
}

main()
  .catch((e) => {
    console.error('Error querying database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

