import { PrismaClient, type Prisma } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const forceFlag = process.argv.includes("--force")

  console.log("=== MRE Database Cleanup: Remove All LiveRC Data ===\n")
  console.log(
    "This will delete all events, races, drivers, and related ingestion/fuzzy matching data."
  )
  console.log("Users and tracks will be preserved.\n")

  // Count what will be deleted - core tables
  const eventCount = await prisma.event.count()
  const raceCount = await prisma.race.count()
  const raceDriverCount = await prisma.raceDriver.count()
  const raceResultCount = await prisma.raceResult.count()
  const lapCount = await prisma.lap.count()
  const driverCount = await prisma.driver.count({ where: { source: "liverc" } })
  const weatherDataCount = await prisma.weatherData.count()

  // Count ingestion and fuzzy matching tables
  const eventEntryCount = await prisma.eventEntry.count()
  const eventDriverLinkCount = await prisma.eventDriverLink.count()
  const userDriverLinkCount = await prisma.userDriverLink.count()
  const transponderOverrideCount = await prisma.transponderOverride.count()

  // Count audit logs that reference LiveRC data (events, ingestion operations)
  // Handle case where audit_logs table doesn't exist yet
  let auditLogCount = 0
  try {
    // Use type assertion since auditLog may not exist in schema
    const auditLogModel = (prisma as Record<string, unknown>).auditLog as
      | {
          count: (args: { where: { resourceType: { in: string[] } } }) => Promise<number>
        }
      | undefined
    if (auditLogModel) {
      auditLogCount = await auditLogModel.count({
        where: {
          resourceType: {
            in: ["event", "ingestion"],
          },
        },
      })
    }
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError
    if (prismaError.code === "P2021") {
      // Table doesn't exist - skip audit log cleanup
      console.log("   ℹ️  Audit logs table does not exist - skipping audit log cleanup")
    } else {
      throw error
    }
  }

  // Count what will be kept
  const trackCount = await prisma.track.count()
  const userCount = await prisma.user.count()

  console.log("📊 Current Database State:")
  console.log(`\n  Will be DELETED (LiveRC Data):`)
  console.log(`    Events: ${eventCount}`)
  console.log(`    Races: ${raceCount}`)
  console.log(`    Race Drivers: ${raceDriverCount}`)
  console.log(`    Race Results: ${raceResultCount}`)
  console.log(`    Laps: ${lapCount}`)
  console.log(`    Drivers (LiveRC): ${driverCount}`)
  console.log(`    Weather Data: ${weatherDataCount}`)
  console.log(`    Event Entries: ${eventEntryCount}`)
  console.log(`    Event Driver Links: ${eventDriverLinkCount}`)
  console.log(`    User Driver Links: ${userDriverLinkCount}`)
  console.log(`    Transponder Overrides: ${transponderOverrideCount}`)
  console.log(`    Audit Logs (event/ingestion): ${auditLogCount}`)
  console.log(`\n  Will be KEPT:`)
  console.log(`    Tracks: ${trackCount}`)
  console.log(`    Users: ${userCount}`)

  const totalToDelete =
    eventCount +
    raceCount +
    raceDriverCount +
    raceResultCount +
    lapCount +
    driverCount +
    weatherDataCount +
    eventEntryCount +
    eventDriverLinkCount +
    userDriverLinkCount +
    transponderOverrideCount +
    auditLogCount

  if (totalToDelete === 0) {
    console.log("\n✅ No LiveRC data to delete. Database is already clean.")
    return
  }

  if (!forceFlag) {
    console.log("\n⚠️  This will permanently delete all LiveRC events and related data!")
    console.log("   To proceed, run with --force flag:")
    console.log("   ts-node scripts/cleanup-events.ts --force")
    process.exit(0)
  }

  console.log("\n🗑️  Starting cleanup...\n")

  // Step 1: Delete all events first
  // This will cascade delete: EventEntry, EventDriverLink, TransponderOverride, Race, RaceDriver, RaceResult, Lap, WeatherData
  console.log("Step 1: Deleting all events (cascade will delete related data)...")
  const deleteResult = await prisma.event.deleteMany({})
  console.log(`   ✅ Deleted ${deleteResult.count} event(s)`)
  console.log(
    `   (Cascade deleted: EventEntry, EventDriverLink, TransponderOverride, Race, RaceDriver, RaceResult, Lap, WeatherData)`
  )

  // Step 2: Delete LiveRC drivers
  // This will cascade delete: EventEntry, UserDriverLink, EventDriverLink, TransponderOverride
  // Note: Some of these may already be deleted by event cascade, but this ensures completeness
  console.log("\nStep 2: Deleting LiveRC drivers (cascade will delete related links)...")
  const driverDeleteResult = await prisma.driver.deleteMany({
    where: { source: "liverc" },
  })
  console.log(`   ✅ Deleted ${driverDeleteResult.count} driver(s)`)
  console.log(
    `   (Cascade deleted: EventEntry, UserDriverLink, EventDriverLink, TransponderOverride)`
  )

  // Step 3: Verify cascade deletes worked and clean up any orphaned records
  // UserDriverLinks should be cascade deleted when drivers are deleted
  // But we verify and clean up any that might remain (shouldn't happen, but safety check)
  console.log("\nStep 3: Verifying cascade deletes and cleaning up any orphaned records...")

  // Check for any remaining UserDriverLinks (they should all be cascade deleted)
  // If any remain, they would be orphaned (pointing to deleted drivers)
  const remainingUserDriverLinks = await prisma.userDriverLink.count()
  if (remainingUserDriverLinks > 0) {
    // All drivers in the system are LiveRC, so any remaining UserDriverLinks are orphaned
    const deletedOrphanedLinks = await prisma.userDriverLink.deleteMany({})
    console.log(`   ✅ Cleaned up ${deletedOrphanedLinks.count} orphaned UserDriverLink(s)`)
  } else {
    console.log(`   ✅ All UserDriverLinks cleaned up (cascade delete worked)`)
  }

  // Check for any remaining EventDriverLinks (should be cascade deleted with events)
  const remainingEventDriverLinks = await prisma.eventDriverLink.count()
  if (remainingEventDriverLinks > 0) {
    const deletedOrphanedEventLinks = await prisma.eventDriverLink.deleteMany({})
    console.log(`   ✅ Cleaned up ${deletedOrphanedEventLinks.count} orphaned EventDriverLink(s)`)
  } else {
    console.log(`   ✅ All EventDriverLinks cleaned up (cascade delete worked)`)
  }

  // Check for any remaining EventEntries (should be cascade deleted with events/drivers)
  const remainingEventEntries = await prisma.eventEntry.count()
  if (remainingEventEntries > 0) {
    const deletedOrphanedEntries = await prisma.eventEntry.deleteMany({})
    console.log(`   ✅ Cleaned up ${deletedOrphanedEntries.count} orphaned EventEntry(s)`)
  } else {
    console.log(`   ✅ All EventEntries cleaned up (cascade delete worked)`)
  }

  // Check for any remaining TransponderOverrides (should be cascade deleted with events/drivers)
  const remainingTransponderOverrides = await prisma.transponderOverride.count()
  if (remainingTransponderOverrides > 0) {
    const deletedOrphanedOverrides = await prisma.transponderOverride.deleteMany({})
    console.log(
      `   ✅ Cleaned up ${deletedOrphanedOverrides.count} orphaned TransponderOverride(s)`
    )
  } else {
    console.log(`   ✅ All TransponderOverrides cleaned up (cascade delete worked)`)
  }

  // Clean up audit logs that reference LiveRC events or ingestion operations
  // These won't cascade delete, so we explicitly clean them up
  // Handle case where audit_logs table doesn't exist yet
  try {
    // Use type assertion since auditLog may not exist in schema
    const auditLogModel = (prisma as Record<string, unknown>).auditLog as
      | {
          deleteMany: (args: {
            where: { resourceType: { in: string[] } }
          }) => Promise<{ count: number }>
        }
      | undefined
    if (auditLogModel) {
      const deletedAuditLogs = await auditLogModel.deleteMany({
        where: {
          resourceType: {
            in: ["event", "ingestion"],
          },
        },
      })
      console.log(
        `   ✅ Cleaned up ${deletedAuditLogs.count} audit log(s) referencing events/ingestion`
      )
    }
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError
    if (prismaError.code === "P2021") {
      // Table doesn't exist - skip audit log cleanup
      console.log(`   ℹ️  Audit logs table does not exist - skipping audit log cleanup`)
    } else {
      throw error
    }
  }

  console.log(`\n✅ Cleanup complete!`)

  // Final verification - check all tables
  console.log("\n📊 Final verification...")
  const remainingEvents = await prisma.event.count()
  const remainingRaces = await prisma.race.count()
  const remainingRaceDrivers = await prisma.raceDriver.count()
  const remainingRaceResults = await prisma.raceResult.count()
  const remainingLaps = await prisma.lap.count()
  const remainingDrivers = await prisma.driver.count({ where: { source: "liverc" } })
  const remainingWeatherData = await prisma.weatherData.count()
  const finalEventEntries = await prisma.eventEntry.count()
  const finalEventDriverLinks = await prisma.eventDriverLink.count()
  const finalUserDriverLinks = await prisma.userDriverLink.count()
  const finalTransponderOverrides = await prisma.transponderOverride.count()
  // Check final audit log count (handle missing table)
  let finalAuditLogs = 0
  try {
    // Use type assertion since auditLog may not exist in schema
    const auditLogModel = (prisma as Record<string, unknown>).auditLog as
      | {
          count: (args: { where: { resourceType: { in: string[] } } }) => Promise<number>
        }
      | undefined
    if (auditLogModel) {
      finalAuditLogs = await auditLogModel.count({
        where: {
          resourceType: {
            in: ["event", "ingestion"],
          },
        },
      })
    }
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError
    if (prismaError.code === "P2021") {
      // Table doesn't exist - treat as clean
      finalAuditLogs = 0
    } else {
      throw error
    }
  }
  const remainingTracks = await prisma.track.count()
  const remainingUsers = await prisma.user.count()

  const allClean =
    remainingEvents === 0 &&
    remainingRaces === 0 &&
    remainingRaceDrivers === 0 &&
    remainingRaceResults === 0 &&
    remainingLaps === 0 &&
    remainingDrivers === 0 &&
    remainingWeatherData === 0 &&
    finalEventEntries === 0 &&
    finalEventDriverLinks === 0 &&
    finalUserDriverLinks === 0 &&
    finalTransponderOverrides === 0 &&
    finalAuditLogs === 0

  console.log("\n📊 Final Database State:")
  console.log(`\n  LiveRC Data (should all be 0):`)
  console.log(`    Events: ${remainingEvents} ${remainingEvents === 0 ? "✅" : "❌"}`)
  console.log(`    Races: ${remainingRaces} ${remainingRaces === 0 ? "✅" : "❌"}`)
  console.log(
    `    Race Drivers: ${remainingRaceDrivers} ${remainingRaceDrivers === 0 ? "✅" : "❌"}`
  )
  console.log(
    `    Race Results: ${remainingRaceResults} ${remainingRaceResults === 0 ? "✅" : "❌"}`
  )
  console.log(`    Laps: ${remainingLaps} ${remainingLaps === 0 ? "✅" : "❌"}`)
  console.log(`    Drivers (LiveRC): ${remainingDrivers} ${remainingDrivers === 0 ? "✅" : "❌"}`)
  console.log(
    `    Weather Data: ${remainingWeatherData} ${remainingWeatherData === 0 ? "✅" : "❌"}`
  )
  console.log(`    Event Entries: ${finalEventEntries} ${finalEventEntries === 0 ? "✅" : "❌"}`)
  console.log(
    `    Event Driver Links: ${finalEventDriverLinks} ${finalEventDriverLinks === 0 ? "✅" : "❌"}`
  )
  console.log(
    `    User Driver Links: ${finalUserDriverLinks} ${finalUserDriverLinks === 0 ? "✅" : "❌"}`
  )
  console.log(
    `    Transponder Overrides: ${finalTransponderOverrides} ${finalTransponderOverrides === 0 ? "✅" : "❌"}`
  )
  console.log(
    `    Audit Logs (event/ingestion): ${finalAuditLogs} ${finalAuditLogs === 0 ? "✅" : "❌"}`
  )
  console.log(`\n  Preserved Data:`)
  console.log(`    Tracks: ${remainingTracks} ✅`)
  console.log(`    Users: ${remainingUsers} ✅`)

  if (allClean) {
    console.log("\n✅ Database cleanup verified - all LiveRC data removed successfully!")
  } else {
    console.log("\n⚠️  Warning: Some LiveRC data may still remain. Please check the counts above.")
  }
}

main()
  .catch((e) => {
    console.error("❌ Error during cleanup:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
