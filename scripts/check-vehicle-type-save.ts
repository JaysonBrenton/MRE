/**
 * @fileoverview Script to check if vehicle type was saved to database
 *
 * Usage: docker exec -it mre-app npx tsx scripts/check-vehicle-type-save.ts <eventId> <className>
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const eventId = process.argv[2]
  const className = process.argv[3]

  if (!eventId || !className) {
    console.error("Usage: npx tsx scripts/check-vehicle-type-save.ts <eventId> <className>")
    process.exit(1)
  }

  console.log(`Checking vehicle type for event: ${eventId}, class: ${className}\n`)

  // Check EventRaceClass
  const eventRaceClass = await prisma.eventRaceClass.findUnique({
    where: {
      eventId_className: {
        eventId,
        className,
      },
    },
  })

  if (eventRaceClass) {
    console.log("✅ EventRaceClass found:")
    console.log({
      id: eventRaceClass.id,
      eventId: eventRaceClass.eventId,
      className: eventRaceClass.className,
      vehicleType: eventRaceClass.vehicleType,
      vehicleTypeNeedsReview: eventRaceClass.vehicleTypeNeedsReview,
      vehicleTypeReviewedAt: eventRaceClass.vehicleTypeReviewedAt,
      vehicleTypeReviewedBy: eventRaceClass.vehicleTypeReviewedBy,
      createdAt: eventRaceClass.createdAt,
      updatedAt: eventRaceClass.updatedAt,
    })

    // Check EventEntry records
    const eventEntries = await prisma.eventEntry.findMany({
      where: {
        eventId,
        className,
      },
      select: {
        id: true,
        className: true,
        eventRaceClassId: true,
      },
      take: 5,
    })

    console.log(`\n📋 EventEntry records (showing first 5 of ${eventEntries.length}):`)
    eventEntries.forEach((entry) => {
      const linked = entry.eventRaceClassId === eventRaceClass.id ? "✅" : "❌"
      console.log(`${linked} Entry ${entry.id}: eventRaceClassId=${entry.eventRaceClassId}`)
    })
  } else {
    console.log("❌ No EventRaceClass found for this event and class")

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, eventName: true },
    })

    if (!event) {
      console.log(`❌ Event ${eventId} not found`)
    } else {
      console.log(`✅ Event exists: ${event.eventName}`)

      // Check what classes exist for this event
      const allClasses = await prisma.eventRaceClass.findMany({
        where: { eventId },
        select: { className: true },
      })

      console.log(`\n📋 Existing classes for this event:`)
      allClasses.forEach((rc) => {
        const match = rc.className === className ? "← MATCH" : ""
        console.log(`  - "${rc.className}" ${match}`)
      })

      // Check EventEntry classes
      const entryClasses = await prisma.eventEntry.findMany({
        where: { eventId },
        select: { className: true },
        distinct: ["className"],
      })

      console.log(`\n📋 Classes from EventEntry:`)
      entryClasses.forEach((entry) => {
        const match = entry.className === className ? "← MATCH" : ""
        console.log(`  - "${entry.className}" ${match}`)
      })
    }
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
