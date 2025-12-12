import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const forceFlag = process.argv.includes('--force')

  console.log('=== MRE Database Cleanup: Remove All Events ===\n')

  // Count what will be deleted
  const eventCount = await prisma.event.count()
  const raceCount = await prisma.race.count()
  const raceDriverCount = await prisma.raceDriver.count()
  const raceResultCount = await prisma.raceResult.count()
  const lapCount = await prisma.lap.count()

  // Count what will be kept
  const trackCount = await prisma.track.count()
  const userCount = await prisma.user.count()

  console.log('📊 Current Database State:')
  console.log(`\n  Will be DELETED:`)
  console.log(`    Events: ${eventCount}`)
  console.log(`    Races: ${raceCount}`)
  console.log(`    Race Drivers: ${raceDriverCount}`)
  console.log(`    Race Results: ${raceResultCount}`)
  console.log(`    Laps: ${lapCount}`)
  console.log(`\n  Will be KEPT:`)
  console.log(`    Tracks: ${trackCount}`)
  console.log(`    Users: ${userCount}`)

  if (eventCount === 0) {
    console.log('\n✅ No events to delete. Database is already clean.')
    return
  }

  if (!forceFlag) {
    console.log('\n⚠️  This will permanently delete all events and related data!')
    console.log('   To proceed, run with --force flag:')
    console.log('   ts-node scripts/cleanup-events.ts --force')
    process.exit(0)
  }

  console.log('\n🗑️  Deleting all events (cascade will delete races, drivers, results, and laps)...')

  // Delete all events - cascade will handle the rest
  const deleteResult = await prisma.event.deleteMany({})

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   Deleted ${deleteResult.count} event(s)`)
  console.log(`   (Cascade deleted all related races, drivers, results, and laps)`)

  // Verify cleanup
  const remainingEvents = await prisma.event.count()
  const remainingRaces = await prisma.race.count()
  const remainingLaps = await prisma.lap.count()
  const remainingTracks = await prisma.track.count()
  const remainingUsers = await prisma.user.count()

  console.log('\n📊 Final Database State:')
  console.log(`    Events: ${remainingEvents}`)
  console.log(`    Races: ${remainingRaces}`)
  console.log(`    Laps: ${remainingLaps}`)
  console.log(`    Tracks: ${remainingTracks} (kept)`)
  console.log(`    Users: ${remainingUsers} (kept)`)
}

main()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
